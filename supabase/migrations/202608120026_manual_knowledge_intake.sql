begin;

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
  if p_draft_json is null
    or jsonb_typeof(p_draft_json) is distinct from 'object'
    or nullif(trim(p_draft_json ->> 'title'), '') is null
    or nullif(trim(p_draft_json ->> 'answerMarkdown'), '') is null
    or nullif(trim(p_draft_json ->> 'changeSummary'), '') is null
    or nullif(trim(p_draft_json ->> 'sourceReference'), '') is null
    or nullif(trim(p_draft_json ->> 'owner'), '') is null
    or (p_draft_json ->> 'domain') not in ('housing', 'group_buy', 'market', 'platform')
    or (p_draft_json ->> 'category') !~ '^[a-z][a-z0-9_-]{1,79}$'
    or nullif(trim(p_draft_json ->> 'effectiveFrom'), '') is null
    or (p_draft_json ->> 'effectiveFrom') !~ '^\d{4}-\d{2}-\d{2}$'
    or to_char((p_draft_json ->> 'effectiveFrom')::date, 'YYYY-MM-DD')
      <> (p_draft_json ->> 'effectiveFrom')
    or (
      p_draft_json ? 'versionLabel'
      and nullif(trim(p_draft_json ->> 'versionLabel'), '') is null
    )
    or (
      p_draft_json ? 'effectiveUntil'
      and (p_draft_json ->> 'effectiveUntil') !~ '^\d{4}-\d{2}-\d{2}$'
    )
    or (
      p_draft_json ? 'effectiveUntil'
      and to_char((p_draft_json ->> 'effectiveUntil')::date, 'YYYY-MM-DD')
        <> (p_draft_json ->> 'effectiveUntil')
    )
    or (
      p_draft_json ? 'effectiveUntil'
      and (p_draft_json ->> 'effectiveUntil')::date
        < (p_draft_json ->> 'effectiveFrom')::date
    )
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

create or replace function public.create_knowledge_candidate_draft(
  p_normalized_question text,
  p_draft_json jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate_id uuid;
begin
  if nullif(trim(p_draft_json ->> 'versionLabel'), '') is null then
    raise exception 'Manual material version label is required';
  end if;

  v_candidate_id := public.enqueue_knowledge_candidate(
    'human_correction',
    null,
    null,
    p_normalized_question,
    p_draft_json ->> 'domain',
    'manual_material_intake',
    '[]'::jsonb
  );
  perform public.save_knowledge_candidate_draft(v_candidate_id, p_draft_json);
  return v_candidate_id;
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
    effective_until,
    status,
    change_summary
  ) values (
    v_article_id,
    v_version_number,
    coalesce(
      nullif(trim(v_candidate.draft_json ->> 'versionLabel'), ''),
      'v' || v_version_number::text
    ),
    v_candidate.draft_json ->> 'answerMarkdown',
    v_candidate.draft_json ->> 'sourceReference',
    (v_candidate.draft_json ->> 'effectiveFrom')::date,
    case
      when v_candidate.draft_json ? 'effectiveUntil'
      then (v_candidate.draft_json ->> 'effectiveUntil')::date
      else null
    end,
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

revoke all on function public.create_knowledge_candidate_draft(text, jsonb)
from public, anon, authenticated;
grant execute on function public.create_knowledge_candidate_draft(text, jsonb)
to service_role;

commit;
