begin;

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
