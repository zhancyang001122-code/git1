begin;

alter table public.knowledge_candidates
  add column if not exists draft_json jsonb,
  add column if not exists publication_result_json jsonb;

alter table public.ai_feedback
  drop constraint if exists ai_feedback_message_id_user_id_key;

create unique index if not exists ai_feedback_message_unique_idx
  on public.ai_feedback (message_id);

create or replace function public.publish_kb_version(
  p_article_id uuid,
  p_version_id uuid,
  p_reviewer_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_article_id uuid;
begin
  select article_id into v_article_id
  from public.kb_article_versions
  where id = p_version_id;

  if v_article_id is null or v_article_id <> p_article_id then
    raise exception 'Version does not belong to article';
  end if;

  update public.kb_article_versions
  set status = 'archived'
  where article_id = p_article_id
    and status = 'published'
    and id <> p_version_id;

  update public.kb_article_versions
  set status = 'published',
      reviewed_by = p_reviewer_id,
      reviewed_at = timezone('utc', now())
  where id = p_version_id;

  update public.kb_articles
  set status = 'published',
      current_version_id = p_version_id,
      updated_at = timezone('utc', now())
  where id = p_article_id;

  update public.kb_chunks
  set embedding_status = case
    when embedding is null then 'pending'::public.embedding_status
    else 'ready'::public.embedding_status
  end
  where version_id = p_version_id;
end;
$$;

create or replace function public.save_knowledge_candidate_draft(
  p_candidate_id uuid,
  p_draft_json jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.knowledge_candidate_status;
begin
  if jsonb_typeof(p_draft_json) <> 'object'
    or nullif(trim(p_draft_json ->> 'title'), '') is null
    or nullif(trim(p_draft_json ->> 'answerMarkdown'), '') is null
    or nullif(trim(p_draft_json ->> 'changeSummary'), '') is null
    or nullif(trim(p_draft_json ->> 'sourceReference'), '') is null
    or nullif(trim(p_draft_json ->> 'owner'), '') is null
    or (p_draft_json ->> 'domain') not in ('housing', 'group_buy', 'market', 'platform')
    or (p_draft_json ->> 'category') !~ '^[a-z][a-z0-9_-]{1,79}$'
    or (p_draft_json ->> 'effectiveFrom') !~ '^\d{4}-\d{2}-\d{2}$'
  then
    raise exception 'Knowledge candidate draft is invalid';
  end if;

  select c.status into v_status
  from public.knowledge_candidates c
  where c.id = p_candidate_id
  for update;

  if v_status is null or v_status in ('rejected', 'published') then
    raise exception 'Knowledge candidate cannot be drafted';
  end if;

  update public.knowledge_candidates
  set draft_json = p_draft_json,
      draft_answer = p_draft_json ->> 'answerMarkdown',
      status = 'drafted'
  where id = p_candidate_id;
end;
$$;

create or replace function public.review_knowledge_candidate(
  p_candidate_id uuid,
  p_decision text,
  p_notes text,
  p_draft_json jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate public.knowledge_candidates%rowtype;
  v_review_id uuid;
  v_draft jsonb;
begin
  if p_decision not in ('approve', 'reject', 'request_changes') then
    raise exception 'Knowledge review decision is invalid';
  end if;
  if nullif(trim(p_notes), '') is null then
    raise exception 'Knowledge review notes are required';
  end if;

  select * into v_candidate
  from public.knowledge_candidates
  where id = p_candidate_id
  for update;

  if v_candidate.id is null or v_candidate.status in ('rejected', 'published') then
    raise exception 'Knowledge candidate cannot be reviewed';
  end if;

  if p_decision = 'approve' then
    v_draft := coalesce(p_draft_json, v_candidate.draft_json);
    perform public.save_knowledge_candidate_draft(p_candidate_id, v_draft);
    update public.knowledge_candidates
    set status = 'approved'
    where id = p_candidate_id;
  elsif p_decision = 'reject' then
    update public.knowledge_candidates
    set status = 'rejected'
    where id = p_candidate_id;
  else
    update public.knowledge_candidates
    set status = 'drafted'
    where id = p_candidate_id;
  end if;

  insert into public.knowledge_reviews (
    candidate_id,
    decision,
    notes
  ) values (
    p_candidate_id,
    p_decision,
    trim(p_notes)
  )
  returning id into v_review_id;

  return v_review_id;
end;
$$;

create or replace function public.prepare_knowledge_publication(
  p_candidate_id uuid
)
returns table (
  candidate_id uuid,
  article_id uuid,
  version_id uuid,
  previous_version_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate public.knowledge_candidates%rowtype;
  v_review_id uuid;
  v_category_id uuid;
  v_article_id uuid;
  v_version_id uuid;
  v_previous_version_id uuid;
  v_version_number integer;
  v_domain text;
  v_category text;
  v_slug text;
begin
  select * into v_candidate
  from public.knowledge_candidates
  where id = p_candidate_id
  for update;

  if v_candidate.id is null
    or v_candidate.status <> 'approved'
    or jsonb_typeof(v_candidate.draft_json) <> 'object'
  then
    raise exception 'Knowledge candidate is not approved';
  end if;

  select r.id, r.created_article_id, r.created_version_id
  into v_review_id, v_article_id, v_version_id
  from public.knowledge_reviews r
  where r.candidate_id = p_candidate_id
    and r.decision = 'approve'
  order by r.created_at desc, r.id desc
  limit 1;

  if v_review_id is null then
    raise exception 'Knowledge candidate approval review is missing';
  end if;

  if v_article_id is not null and v_version_id is not null then
    select v.version_id into v_previous_version_id
    from (
      select av.id as version_id
      from public.kb_article_versions av
      where av.article_id = v_article_id
        and av.id <> v_version_id
      order by av.version_number desc
      limit 1
    ) v;
    return query
    select p_candidate_id, v_article_id, v_version_id, v_previous_version_id;
    return;
  end if;

  v_domain := v_candidate.draft_json ->> 'domain';
  v_category := v_candidate.draft_json ->> 'category';
  v_slug := v_domain || '-' || v_category;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('knowledge-publication:' || v_slug, 0)
  );

  insert into public.kb_categories (domain, slug, name, description)
  values (v_domain, v_category, v_category, '知识运营发布分类')
  on conflict (domain, slug) do update
  set description = public.kb_categories.description
  returning id into v_category_id;

  insert into public.kb_articles (
    category_id,
    slug,
    title,
    owner_name,
    status
  ) values (
    v_category_id,
    v_slug,
    v_candidate.draft_json ->> 'title',
    v_candidate.draft_json ->> 'owner',
    'draft'
  )
  on conflict (slug) do update
  set title = excluded.title,
      owner_name = excluded.owner_name
  returning id, current_version_id
  into v_article_id, v_previous_version_id;

  select coalesce(max(v.version_number), 0) + 1
  into v_version_number
  from public.kb_article_versions v
  where v.article_id = v_article_id;

  insert into public.kb_article_versions (
    article_id,
    version_number,
    version_label,
    content_markdown,
    source_reference,
    effective_from,
    status,
    change_summary
  ) values (
    v_article_id,
    v_version_number,
    'v' || v_version_number::text,
    v_candidate.draft_json ->> 'answerMarkdown',
    v_candidate.draft_json ->> 'sourceReference',
    (v_candidate.draft_json ->> 'effectiveFrom')::date,
    'reviewing',
    v_candidate.draft_json ->> 'changeSummary'
  )
  returning id into v_version_id;

  update public.knowledge_reviews
  set created_article_id = v_article_id,
      created_version_id = v_version_id
  where id = v_review_id;

  return query
  select p_candidate_id, v_article_id, v_version_id, v_previous_version_id;
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

  perform public.publish_kb_version(p_article_id, p_version_id, null);

  update public.knowledge_candidates
  set status = 'published'
  where id = p_candidate_id;
end;
$$;

create or replace function public.rollback_knowledge_candidate(
  p_candidate_id uuid
)
returns table (
  article_id uuid,
  version_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_article_id uuid;
  v_published_version_id uuid;
  v_previous_version_id uuid;
begin
  select r.created_article_id, r.created_version_id
  into v_article_id, v_published_version_id
  from public.knowledge_reviews r
  where r.candidate_id = p_candidate_id
    and r.decision = 'approve'
    and r.created_article_id is not null
    and r.created_version_id is not null
  order by r.created_at desc, r.id desc
  limit 1;

  if v_article_id is null or v_published_version_id is null then
    raise exception 'Knowledge rollback is unavailable';
  end if;

  select v.id into v_previous_version_id
  from public.kb_article_versions v
  where v.article_id = v_article_id
    and v.id <> v_published_version_id
    and v.status in ('archived', 'published')
  order by v.version_number desc
  limit 1;

  if v_previous_version_id is null then
    raise exception 'Knowledge rollback is unavailable';
  end if;

  perform public.publish_kb_version(v_article_id, v_previous_version_id, null);

  update public.knowledge_candidates
  set publication_result_json = coalesce(publication_result_json, '{}'::jsonb)
    || jsonb_build_object(
      'rolledBack', true,
      'rolledBackAt', timezone('utc', now()),
      'activeVersionId', v_previous_version_id
    )
  where id = p_candidate_id;

  return query select v_article_id, v_previous_version_id;
end;
$$;

revoke all on function public.save_knowledge_candidate_draft(uuid, jsonb)
from public, anon, authenticated;
revoke all on function public.review_knowledge_candidate(uuid, text, text, jsonb)
from public, anon, authenticated;
revoke all on function public.prepare_knowledge_publication(uuid)
from public, anon, authenticated;
revoke all on function public.publish_knowledge_candidate(uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.rollback_knowledge_candidate(uuid)
from public, anon, authenticated;

grant execute on function public.save_knowledge_candidate_draft(uuid, jsonb)
to service_role;
grant execute on function public.review_knowledge_candidate(uuid, text, text, jsonb)
to service_role;
grant execute on function public.prepare_knowledge_publication(uuid)
to service_role;
grant execute on function public.publish_knowledge_candidate(uuid, uuid, uuid)
to service_role;
grant execute on function public.rollback_knowledge_candidate(uuid)
to service_role;

commit;
