begin;

alter table public.kb_articles
  drop constraint if exists kb_articles_material_kind_check;
alter table public.kb_articles
  add constraint kb_articles_material_kind_check
  check (material_kind in (
    'demo',
    'portfolio_first_party',
    'public_official',
    'external_authorized'
  ));

alter table public.kb_article_versions
  drop constraint if exists kb_article_versions_material_kind_check;
alter table public.kb_article_versions
  add constraint kb_article_versions_material_kind_check
  check (material_kind in (
    'demo',
    'portfolio_first_party',
    'public_official',
    'external_authorized'
  ));

create or replace function public.classify_knowledge_material()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.material_kind := case
    when new.is_demo then 'demo'
    when new.material_kind = 'portfolio_first_party'
      or new.source_reference like 'knowledge-base/portfolio-first-party/%'
      then 'portfolio_first_party'
    when new.material_kind = 'public_official'
      or new.source_reference like 'knowledge-base/public-official/%'
      then 'public_official'
    else new.material_kind
  end;

  update public.kb_articles
  set material_kind = new.material_kind
  where id = new.article_id;
  return new;
end;
$$;

revoke all on function public.classify_knowledge_material()
from public, anon, authenticated;

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
    or coalesce(
      p_draft_json ->> 'materialKind',
      'external_authorized'
    ) not in (
      'demo',
      'portfolio_first_party',
      'public_official',
      'external_authorized'
    )
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

revoke all on function public.save_knowledge_candidate_draft(uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.save_knowledge_candidate_draft(uuid, jsonb)
to service_role;

drop function if exists public.hybrid_search_kb_v2(
  text,
  extensions.vector(1024),
  text,
  text,
  text,
  integer,
  double precision,
  double precision
);

create function public.hybrid_search_kb_v2(
  p_query_text text,
  p_query_embedding extensions.vector(1024),
  p_domain text default null,
  p_category_slug text default null,
  p_city text default null,
  p_match_count integer default 12,
  p_vector_weight double precision default 0.65,
  p_text_weight double precision default 0.35
)
returns table (
  chunk_id uuid,
  article_id uuid,
  version_id uuid,
  chunk_index integer,
  title text,
  version_label text,
  source_reference text,
  effective_from date,
  effective_until date,
  article_status public.knowledge_status,
  version_status public.knowledge_status,
  content text,
  metadata jsonb,
  vector_score double precision,
  text_score double precision,
  combined_score double precision,
  is_demo boolean,
  material_kind text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with parameters as (
    select
      (statement_timestamp() at time zone 'Asia/Shanghai')::date
        as business_date
  ),
  eligible as (
    select
      c.id as chunk_id,
      a.id as article_id,
      v.id as version_id,
      c.chunk_index,
      a.title,
      v.version_label,
      v.source_reference,
      v.effective_from,
      v.effective_until,
      a.status as article_status,
      v.status as version_status,
      c.content,
      c.metadata,
      greatest(
        0::double precision,
        1 - (c.embedding OPERATOR(extensions.<=>) p_query_embedding)
      ) as vector_score,
      greatest(
        0::double precision,
        extensions.similarity(c.content, p_query_text)
      ) as text_score,
      (
        coalesce((c.metadata ->> 'isDemo') = 'true', false)
        or a.is_demo
        or v.is_demo
      ) as is_demo,
      case
        when coalesce((c.metadata ->> 'isDemo') = 'true', false)
          or a.is_demo
          or v.is_demo
        then 'demo'
        when coalesce(c.metadata ->> 'materialKind', v.material_kind, a.material_kind)
          = 'portfolio_first_party'
        then 'portfolio_first_party'
        when coalesce(c.metadata ->> 'materialKind', v.material_kind, a.material_kind)
          = 'public_official'
        then 'public_official'
        else 'external_authorized'
      end as material_kind
    from public.kb_chunks c
    join public.kb_article_versions v on v.id = c.version_id
    join public.kb_articles a on a.id = c.article_id and a.current_version_id = v.id
    join public.kb_categories cat on cat.id = a.category_id
    cross join parameters p
    where c.embedding_status = 'ready'
      and c.embedding is not null
      and a.status = 'published'
      and v.status = 'published'
      and (v.effective_from is null or v.effective_from <= p.business_date)
      and (v.effective_until is null or v.effective_until >= p.business_date)
      and (p_domain is null or cat.domain = p_domain)
      and (p_category_slug is null or cat.slug = p_category_slug)
      and (p_city is null or a.city is null or a.city = p_city)
  )
  select
    e.chunk_id,
    e.article_id,
    e.version_id,
    e.chunk_index,
    e.title,
    e.version_label,
    e.source_reference,
    e.effective_from,
    e.effective_until,
    e.article_status,
    e.version_status,
    e.content,
    e.metadata,
    e.vector_score,
    e.text_score,
    (e.vector_score * p_vector_weight + e.text_score * p_text_weight) as combined_score,
    e.is_demo,
    e.material_kind
  from eligible e
  order by combined_score desc, e.chunk_id
  limit greatest(1, least(p_match_count, 20));
$$;

revoke all on function public.hybrid_search_kb_v2(
  text,
  extensions.vector(1024),
  text,
  text,
  text,
  integer,
  double precision,
  double precision
) from public, anon, authenticated;

grant execute on function public.hybrid_search_kb_v2(
  text,
  extensions.vector(1024),
  text,
  text,
  text,
  integer,
  double precision,
  double precision
) to service_role;

commit;
