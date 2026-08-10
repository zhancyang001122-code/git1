begin;

alter table public.kb_chunks
  add column if not exists content_hash text;

alter table public.knowledge_candidates
  add column if not exists occurrence_count integer not null default 1
    check (occurrence_count > 0),
  add column if not exists last_seen_at timestamptz not null
    default timezone('utc', now());

create index if not exists kb_chunks_content_hash_idx
  on public.kb_chunks (version_id, content_hash);

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
  is_demo boolean
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
      greatest(0::double precision, extensions.similarity(c.content, p_query_text)) as text_score,
      coalesce((c.metadata ->> 'isDemo') = 'true', false) as is_demo
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
    e.is_demo
  from eligible e
  order by combined_score desc, e.chunk_id
  limit greatest(1, least(p_match_count, 20));
$$;

revoke all on function public.hybrid_search_kb_v2(text, extensions.vector(1024), text, text, text, integer, double precision, double precision) from public, anon, authenticated;
grant execute on function public.hybrid_search_kb_v2(text, extensions.vector(1024), text, text, text, integer, double precision, double precision) to service_role;

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
  v_question text := left(trim(p_normalized_question), 500);
begin
  if length(v_question) < 2 then
    raise exception 'Candidate question is too short';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(coalesce(p_domain, '') || ':' || lower(v_question), 0)
  );

  select id into v_id
  from public.knowledge_candidates
  where normalized_question = v_question
    and domain is not distinct from p_domain
    and status in ('pending', 'drafted', 'reviewing')
  order by created_at desc
  limit 1;

  if v_id is not null then
    update public.knowledge_candidates
    set occurrence_count = occurrence_count + 1,
        last_seen_at = timezone('utc', now()),
        source_type = p_source_type,
        source_session_id = p_source_session_id,
        source_message_id = p_source_message_id,
        reason = p_reason,
        evidence_json = case
          when jsonb_typeof(coalesce(p_evidence_json, '[]'::jsonb)) = 'array'
            and jsonb_array_length(coalesce(p_evidence_json, '[]'::jsonb)) > 0
          then p_evidence_json
          else evidence_json
        end
    where id = v_id;
    return v_id;
  end if;

  insert into public.knowledge_candidates (
    source_type,
    source_session_id,
    source_message_id,
    normalized_question,
    domain,
    reason,
    evidence_json,
    last_seen_at
  ) values (
    p_source_type,
    p_source_session_id,
    p_source_message_id,
    v_question,
    p_domain,
    p_reason,
    coalesce(p_evidence_json, '[]'::jsonb),
    timezone('utc', now())
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.enqueue_knowledge_candidate(text, uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_knowledge_candidate(text, uuid, uuid, text, text, text, jsonb) to service_role;

commit;
