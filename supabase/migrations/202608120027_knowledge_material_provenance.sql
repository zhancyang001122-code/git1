begin;

alter table public.kb_articles
  add column if not exists material_kind text not null default 'external_authorized'
  check (material_kind in ('demo', 'portfolio_first_party', 'external_authorized'));

alter table public.kb_article_versions
  add column if not exists material_kind text not null default 'external_authorized'
  check (material_kind in ('demo', 'portfolio_first_party', 'external_authorized'));

update public.kb_articles
set material_kind = 'demo'
where is_demo = true;

update public.kb_article_versions
set material_kind = 'demo'
where is_demo = true;

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
    else new.material_kind
  end;

  update public.kb_articles
  set material_kind = new.material_kind
  where id = new.article_id;
  return new;
end;
$$;

drop trigger if exists kb_versions_classify_material
on public.kb_article_versions;
create trigger kb_versions_classify_material
  before insert or update of source_reference, is_demo
  on public.kb_article_versions
  for each row execute function public.classify_knowledge_material();

update public.kb_article_versions
set material_kind = case
  when is_demo then 'demo'
  when source_reference like 'knowledge-base/portfolio-first-party/%'
    then 'portfolio_first_party'
  else 'external_authorized'
end;

create or replace function public.protect_published_kb_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status in ('published', 'archived') and (
    new.article_id is distinct from old.article_id or
    new.version_number is distinct from old.version_number or
    new.version_label is distinct from old.version_label or
    new.content_markdown is distinct from old.content_markdown or
    new.source_reference is distinct from old.source_reference or
    new.effective_from is distinct from old.effective_from or
    new.effective_until is distinct from old.effective_until or
    new.material_kind is distinct from old.material_kind
  ) then
    raise exception 'Published knowledge versions are immutable; create a new version';
  end if;
  return new;
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
    ) not in ('demo', 'portfolio_first_party', 'external_authorized')
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
  v_material_kind text;
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
  v_material_kind := coalesce(
    v_candidate.draft_json ->> 'materialKind',
    'external_authorized'
  );

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
    status,
    material_kind
  ) values (
    v_category_id,
    v_slug,
    v_candidate.draft_json ->> 'title',
    v_candidate.draft_json ->> 'owner',
    'draft',
    v_material_kind
  )
  on conflict (slug) do update
  set title = excluded.title,
      owner_name = excluded.owner_name,
      material_kind = excluded.material_kind
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
    change_summary,
    material_kind
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
    v_candidate.draft_json ->> 'changeSummary',
    v_material_kind
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

drop function public.hybrid_search_kb_v2(
  text,
  extensions.vector(1024),
  text,
  text,
  text,
  integer,
  double precision,
  double precision
);

create or replace function public.hybrid_search_kb_v2(
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
  with eligible as (
    select
      c.id as chunk_id,
      a.id as article_id,
      v.id as version_id,
      c.chunk_index,
      a.title,
      v.version_label,
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
        else 'external_authorized'
      end as material_kind
    from public.kb_chunks c
    join public.kb_article_versions v on v.id = c.version_id
    join public.kb_articles a on a.id = c.article_id and a.current_version_id = v.id
    join public.kb_categories cat on cat.id = a.category_id
    where c.embedding_status = 'ready'
      and c.embedding is not null
      and a.status = 'published'
      and v.status = 'published'
      and (v.effective_from is null or v.effective_from <= current_date)
      and (v.effective_until is null or v.effective_until >= current_date)
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
