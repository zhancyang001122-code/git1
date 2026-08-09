begin;

create or replace function public.hybrid_search_kb(
  p_query_text text,
  p_query_embedding extensions.vector(1024),
  p_domain text default null,
  p_category_slug text default null,
  p_city text default null,
  p_match_count integer default 5,
  p_vector_weight double precision default 0.65,
  p_text_weight double precision default 0.35
)
returns table (
  chunk_id uuid,
  article_id uuid,
  version_id uuid,
  title text,
  version_label text,
  effective_from date,
  content text,
  metadata jsonb,
  vector_score double precision,
  text_score double precision,
  combined_score double precision
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
      a.title,
      v.version_label,
      v.effective_from,
      c.content,
      c.metadata,
      greatest(0::double precision, 1 - (c.embedding <=> p_query_embedding)) as vector_score,
      greatest(0::double precision, extensions.similarity(c.content, p_query_text)) as text_score
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
    e.title,
    e.version_label,
    e.effective_from,
    e.content,
    e.metadata,
    e.vector_score,
    e.text_score,
    (e.vector_score * p_vector_weight + e.text_score * p_text_weight) as combined_score
  from eligible e
  order by combined_score desc, e.chunk_id
  limit greatest(1, least(p_match_count, 20));
$$;

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
  set status = 'published', reviewed_by = p_reviewer_id, reviewed_at = timezone('utc', now())
  where id = p_version_id;

  update public.kb_articles
  set status = 'published', current_version_id = p_version_id, updated_at = timezone('utc', now())
  where id = p_article_id;

  update public.kb_chunks
  set embedding_status = case when embedding is null then 'pending' else 'ready' end
  where version_id = p_version_id;
end;
$$;

create or replace function public.enqueue_knowledge_candidate(
  p_source_type text,
  p_source_session_id uuid,
  p_source_message_id uuid,
  p_normalized_question text,
  p_domain text,
  p_reason text,
  p_evidence_json jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.knowledge_candidates (
    source_type,
    source_session_id,
    source_message_id,
    normalized_question,
    domain,
    reason,
    evidence_json
  ) values (
    p_source_type,
    p_source_session_id,
    p_source_message_id,
    p_normalized_question,
    p_domain,
    p_reason,
    coalesce(p_evidence_json, '[]'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.hybrid_search_kb(text, extensions.vector(1024), text, text, text, integer, double precision, double precision) from public, anon, authenticated;
revoke all on function public.publish_kb_version(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.enqueue_knowledge_candidate(text, uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.hybrid_search_kb(text, extensions.vector(1024), text, text, text, integer, double precision, double precision) to service_role;
grant execute on function public.publish_kb_version(uuid, uuid, uuid) to service_role;
grant execute on function public.enqueue_knowledge_candidate(text, uuid, uuid, text, text, text, jsonb) to service_role;

commit;
