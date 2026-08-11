begin;

create table public.knowledge_index_jobs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.knowledge_candidates(id) on delete set null,
  version_id uuid not null references public.kb_article_versions(id) on delete cascade,
  previous_version_id uuid references public.kb_article_versions(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retrying', 'succeeded', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  available_at timestamptz not null default timezone('utc', now()),
  lease_expires_at timestamptz,
  locked_by uuid,
  last_error_code text,
  result_json jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (version_id),
  check (
    (status = 'processing' and lease_expires_at is not null and locked_by is not null)
    or (status <> 'processing' and lease_expires_at is null and locked_by is null)
  )
);

create index knowledge_index_jobs_claim_idx
  on public.knowledge_index_jobs (available_at, created_at)
  where status in ('pending', 'retrying');

alter table public.knowledge_index_jobs enable row level security;

create trigger knowledge_index_jobs_set_updated_at
before update on public.knowledge_index_jobs
for each row execute function public.set_updated_at();

create or replace function public.enqueue_knowledge_index_job(
  p_candidate_id uuid,
  p_version_id uuid,
  p_previous_version_id uuid default null
)
returns setof public.knowledge_index_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.knowledge_index_jobs%rowtype;
begin
  if not exists (
    select 1
    from public.kb_article_versions v
    where v.id = p_version_id
      and v.status = 'published'
  ) then
    raise exception 'Knowledge version is not published';
  end if;

  if p_candidate_id is not null and not exists (
    select 1
    from public.knowledge_candidates c
    join public.knowledge_reviews r on r.candidate_id = c.id
    where c.id = p_candidate_id
      and c.status = 'published'
      and r.decision = 'approve'
      and r.created_version_id = p_version_id
  ) then
    raise exception 'Knowledge job does not match a published candidate';
  end if;

  if p_previous_version_id is not null and not exists (
    select 1
    from public.kb_article_versions current_version
    join public.kb_article_versions previous_version
      on previous_version.article_id = current_version.article_id
    where current_version.id = p_version_id
      and previous_version.id = p_previous_version_id
  ) then
    raise exception 'Previous knowledge version belongs to another article';
  end if;

  insert into public.knowledge_index_jobs as existing (
    candidate_id,
    version_id,
    previous_version_id
  ) values (
    p_candidate_id,
    p_version_id,
    p_previous_version_id
  )
  on conflict (version_id) do update
  set candidate_id = coalesce(existing.candidate_id, excluded.candidate_id),
      previous_version_id = coalesce(
        existing.previous_version_id,
        excluded.previous_version_id
      ),
      status = case
        when existing.status = 'failed' then 'pending'
        else existing.status
      end,
      attempt_count = case
        when existing.status = 'failed' then 0
        else existing.attempt_count
      end,
      available_at = case
        when existing.status = 'failed' then timezone('utc', now())
        else existing.available_at
      end,
      last_error_code = case
        when existing.status = 'failed' then null
        else existing.last_error_code
      end,
      result_json = case
        when existing.status = 'failed' then null
        else existing.result_json
      end,
      completed_at = case
        when existing.status = 'failed' then null
        else existing.completed_at
      end
  returning * into v_job;

  return next v_job;
  return;
end;
$$;

create or replace function public.claim_knowledge_index_job(
  p_worker_id uuid,
  p_lease_seconds integer
)
returns setof public.knowledge_index_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
  v_job public.knowledge_index_jobs%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_lease_seconds integer := greatest(15, least(p_lease_seconds, 300));
begin
  update public.knowledge_index_jobs
  set status = case
        when attempt_count >= max_attempts then 'failed'
        else 'retrying'
      end,
      available_at = v_now,
      lease_expires_at = null,
      locked_by = null,
      last_error_code = 'WORKER_LEASE_EXPIRED',
      completed_at = case
        when attempt_count >= max_attempts then v_now
        else null
      end
  where status = 'processing'
    and lease_expires_at <= v_now;

  select j.id into v_job_id
  from public.knowledge_index_jobs j
  where j.status in ('pending', 'retrying')
    and j.available_at <= v_now
    and j.attempt_count < j.max_attempts
  order by j.available_at, j.created_at, j.id
  for update skip locked
  limit 1;

  if v_job_id is null then
    return;
  end if;

  update public.knowledge_index_jobs j
  set status = 'processing',
      attempt_count = j.attempt_count + 1,
      lease_expires_at = v_now + make_interval(secs => v_lease_seconds),
      locked_by = p_worker_id,
      last_error_code = null,
      completed_at = null
  where j.id = v_job_id
  returning j.* into v_job;

  return next v_job;
  return;
end;
$$;

create or replace function public.publish_knowledge_candidate(
  p_candidate_id uuid,
  p_article_id uuid,
  p_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_version_id uuid;
begin
  if not exists (
    select 1
    from public.knowledge_candidates c
    join public.knowledge_reviews r on r.candidate_id = c.id
    where c.id = p_candidate_id
      and c.status = 'approved'
      and r.decision = 'approve'
      and r.created_article_id = p_article_id
      and r.created_version_id = p_version_id
  ) then
    raise exception 'Knowledge publication does not match an approved candidate';
  end if;

  select a.current_version_id into v_previous_version_id
  from public.kb_articles a
  where a.id = p_article_id
  for update;

  if v_previous_version_id = p_version_id then
    v_previous_version_id := null;
  end if;

  perform public.publish_kb_version(p_article_id, p_version_id, null);

  update public.knowledge_candidates
  set status = 'published'
  where id = p_candidate_id;

  perform public.enqueue_knowledge_index_job(
    p_candidate_id,
    p_version_id,
    v_previous_version_id
  );
end;
$$;

create or replace function public.complete_knowledge_index_job(
  p_job_id uuid,
  p_worker_id uuid,
  p_result_json jsonb
)
returns setof public.knowledge_index_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.knowledge_index_jobs%rowtype;
begin
  update public.knowledge_index_jobs j
  set status = 'succeeded',
      result_json = coalesce(p_result_json, '{}'::jsonb),
      completed_at = timezone('utc', now()),
      lease_expires_at = null,
      locked_by = null,
      last_error_code = null
  where j.id = p_job_id
    and j.status = 'processing'
    and j.locked_by = p_worker_id
  returning j.* into v_job;

  if v_job.id is null then
    raise exception 'Knowledge index lease is no longer owned by this worker';
  end if;

  return next v_job;
  return;
end;
$$;

create or replace function public.fail_knowledge_index_job(
  p_job_id uuid,
  p_worker_id uuid,
  p_error_code text,
  p_retryable boolean,
  p_retry_delay_seconds integer
)
returns setof public.knowledge_index_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.knowledge_index_jobs%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_retry_delay_seconds integer := greatest(
    0,
    least(p_retry_delay_seconds, 3600)
  );
begin
  if nullif(trim(p_error_code), '') is null or length(p_error_code) > 120 then
    raise exception 'Knowledge index error code is invalid';
  end if;

  update public.knowledge_index_jobs j
  set status = case
        when p_retryable and j.attempt_count < j.max_attempts then 'retrying'
        else 'failed'
      end,
      available_at = case
        when p_retryable and j.attempt_count < j.max_attempts
          then v_now + make_interval(secs => v_retry_delay_seconds)
        else j.available_at
      end,
      lease_expires_at = null,
      locked_by = null,
      last_error_code = trim(p_error_code),
      completed_at = case
        when p_retryable and j.attempt_count < j.max_attempts then null
        else v_now
      end
  where j.id = p_job_id
    and j.status = 'processing'
    and j.locked_by = p_worker_id
  returning j.* into v_job;

  if v_job.id is null then
    raise exception 'Knowledge index lease is no longer owned by this worker';
  end if;

  return next v_job;
  return;
end;
$$;

revoke all on table public.knowledge_index_jobs
from public, anon, authenticated;

revoke all on function public.enqueue_knowledge_index_job(uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.claim_knowledge_index_job(uuid, integer)
from public, anon, authenticated;
revoke all on function public.complete_knowledge_index_job(uuid, uuid, jsonb)
from public, anon, authenticated;
revoke all on function public.fail_knowledge_index_job(uuid, uuid, text, boolean, integer)
from public, anon, authenticated;

grant execute on function public.enqueue_knowledge_index_job(uuid, uuid, uuid)
to service_role;
grant execute on function public.claim_knowledge_index_job(uuid, integer)
to service_role;
grant execute on function public.complete_knowledge_index_job(uuid, uuid, jsonb)
to service_role;
grant execute on function public.fail_knowledge_index_job(uuid, uuid, text, boolean, integer)
to service_role;

revoke all on function public.publish_knowledge_candidate(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.publish_knowledge_candidate(uuid, uuid, uuid)
to service_role;

commit;
