begin;

create index if not exists conversation_messages_role_created_idx
  on public.conversation_messages (role, created_at desc);
create index if not exists ai_tool_runs_tool_status_created_idx
  on public.ai_tool_runs (tool_name, status, created_at desc);
create index if not exists ai_feedback_rating_created_idx
  on public.ai_feedback (rating, created_at desc);
create index if not exists knowledge_candidates_created_idx
  on public.knowledge_candidates (created_at desc);
create index if not exists ai_eval_runs_created_idx
  on public.ai_eval_runs (created_at desc);

create or replace function public.get_ai_ops_dashboard(p_window_hours integer default 168)
returns table (
  window_hours integer,
  generated_at timestamptz,
  sessions bigint,
  assistant_messages bigint,
  input_tokens bigint,
  output_tokens bigint,
  tool_runs bigint,
  tool_failures bigint,
  knowledge_searches bigint,
  knowledge_search_failures bigint,
  feedback_up bigint,
  feedback_down bigint,
  eval_runs bigint,
  eval_passed bigint,
  candidates_created bigint,
  published_versions bigint,
  demo_published_versions bigint,
  ready_chunks bigint
)
language sql
security invoker
set search_path = ''
as $$
  with parameters as (
    select
      greatest(1, least(p_window_hours, 720)) as bounded_hours,
      now() as measured_at
  ),
  session_stats as (
    select count(*) as sessions
    from public.conversation_sessions sessions, parameters
    where sessions.created_at >= parameters.measured_at - make_interval(hours => parameters.bounded_hours)
  ),
  message_stats as (
    select
      count(*) as assistant_messages,
      coalesce(sum(messages.input_tokens), 0)::bigint as input_tokens,
      coalesce(sum(messages.output_tokens), 0)::bigint as output_tokens
    from public.conversation_messages messages, parameters
    where messages.role = 'assistant'
      and messages.created_at >= parameters.measured_at - make_interval(hours => parameters.bounded_hours)
  ),
  tool_stats as (
    select
      count(*) as tool_runs,
      count(*) filter (where runs.status in ('failed', 'timed_out')) as tool_failures,
      count(*) filter (where runs.tool_name = 'search_knowledge') as knowledge_searches,
      count(*) filter (
        where runs.tool_name = 'search_knowledge'
          and runs.status in ('failed', 'timed_out')
      ) as knowledge_search_failures
    from public.ai_tool_runs runs, parameters
    where runs.status in ('succeeded', 'failed', 'timed_out')
      and runs.created_at >= parameters.measured_at - make_interval(hours => parameters.bounded_hours)
  ),
  feedback_stats as (
    select
      count(*) filter (where feedback.rating = 'up') as feedback_up,
      count(*) filter (where feedback.rating = 'down') as feedback_down
    from public.ai_feedback feedback, parameters
    where feedback.created_at >= parameters.measured_at - make_interval(hours => parameters.bounded_hours)
  ),
  eval_stats as (
    select
      count(*) as eval_runs,
      count(*) filter (where evals.passed = true) as eval_passed
    from public.ai_eval_runs evals, parameters
    where evals.created_at >= parameters.measured_at - make_interval(hours => parameters.bounded_hours)
  ),
  candidate_stats as (
    select count(*) as candidates_created
    from public.knowledge_candidates candidates, parameters
    where candidates.created_at >= parameters.measured_at - make_interval(hours => parameters.bounded_hours)
  ),
  version_stats as (
    select
      count(*) filter (where versions.status = 'published') as published_versions,
      count(*) filter (
        where versions.status = 'published' and versions.is_demo = true
      ) as demo_published_versions
    from public.kb_article_versions versions
  ),
  chunk_stats as (
    select count(*) filter (where chunks.embedding_status = 'ready') as ready_chunks
    from public.kb_chunks chunks
  )
  select
    parameters.bounded_hours,
    parameters.measured_at,
    session_stats.sessions,
    message_stats.assistant_messages,
    message_stats.input_tokens,
    message_stats.output_tokens,
    tool_stats.tool_runs,
    tool_stats.tool_failures,
    tool_stats.knowledge_searches,
    tool_stats.knowledge_search_failures,
    feedback_stats.feedback_up,
    feedback_stats.feedback_down,
    eval_stats.eval_runs,
    eval_stats.eval_passed,
    candidate_stats.candidates_created,
    version_stats.published_versions,
    version_stats.demo_published_versions,
    chunk_stats.ready_chunks
  from parameters
  cross join session_stats
  cross join message_stats
  cross join tool_stats
  cross join feedback_stats
  cross join eval_stats
  cross join candidate_stats
  cross join version_stats
  cross join chunk_stats;
$$;

create or replace function public.get_rag_ops_trend(p_days integer default 7)
returns table (
  bucket_date date,
  knowledge_searches bigint,
  knowledge_successes bigint,
  no_result_searches bigint,
  avg_duration_ms bigint,
  feedback_up bigint,
  feedback_down bigint,
  eval_runs bigint,
  eval_passed bigint,
  candidates_created bigint
)
language sql
security invoker
set search_path = ''
as $$
  with parameters as (
    select
      greatest(1, least(p_days, 30)) as bounded_days,
      (now() at time zone 'Asia/Shanghai')::date as today
  ),
  days as (
    select generate_series(
      parameters.today - (parameters.bounded_days - 1),
      parameters.today,
      interval '1 day'
    )::date as bucket_date
    from parameters
  ),
  rag_runs as (
    select
      (runs.created_at at time zone 'Asia/Shanghai')::date as bucket_date,
      count(*) as knowledge_searches,
      count(*) filter (where runs.status = 'succeeded') as knowledge_successes,
      count(*) filter (
        where runs.status = 'succeeded'
          and runs.output_summary ->> 'resultCount' = '0'
      ) as no_result_searches,
      round(avg(runs.duration_ms))::bigint as avg_duration_ms
    from public.ai_tool_runs runs, parameters
    where runs.tool_name = 'search_knowledge'
      and runs.status in ('succeeded', 'failed', 'timed_out')
      and runs.created_at >= (
        (parameters.today - (parameters.bounded_days - 1))::timestamp
        at time zone 'Asia/Shanghai'
      )
    group by 1
  ),
  rag_messages as (
    select distinct runs.message_id
    from public.ai_tool_runs runs, parameters
    where runs.tool_name = 'search_knowledge'
      and runs.status in ('succeeded', 'failed', 'timed_out')
      and runs.message_id is not null
      and runs.created_at >= (
        (parameters.today - (parameters.bounded_days - 1))::timestamp
        at time zone 'Asia/Shanghai'
      )
  ),
  rag_feedback as (
    select
      (feedback.created_at at time zone 'Asia/Shanghai')::date as bucket_date,
      count(*) filter (where feedback.rating = 'up') as feedback_up,
      count(*) filter (where feedback.rating = 'down') as feedback_down
    from public.ai_feedback feedback
    join rag_messages on rag_messages.message_id = feedback.message_id
    group by 1
  ),
  rag_evals as (
    select
      (evals.created_at at time zone 'Asia/Shanghai')::date as bucket_date,
      count(*) as eval_runs,
      count(*) filter (where evals.passed = true) as eval_passed
    from public.ai_eval_runs evals
    join public.ai_eval_cases cases on cases.id = evals.case_id
    cross join parameters
    where cases.category in ('rag', 'no_answer')
      and evals.created_at >= (
        (parameters.today - (parameters.bounded_days - 1))::timestamp
        at time zone 'Asia/Shanghai'
      )
    group by 1
  ),
  candidate_stats as (
    select
      (candidates.created_at at time zone 'Asia/Shanghai')::date as bucket_date,
      count(*) as candidates_created
    from public.knowledge_candidates candidates, parameters
    where candidates.created_at >= (
      (parameters.today - (parameters.bounded_days - 1))::timestamp
      at time zone 'Asia/Shanghai'
    )
    group by 1
  )
  select
    days.bucket_date,
    coalesce(rag_runs.knowledge_searches, 0)::bigint,
    coalesce(rag_runs.knowledge_successes, 0)::bigint,
    coalesce(rag_runs.no_result_searches, 0)::bigint,
    rag_runs.avg_duration_ms,
    coalesce(rag_feedback.feedback_up, 0)::bigint,
    coalesce(rag_feedback.feedback_down, 0)::bigint,
    coalesce(rag_evals.eval_runs, 0)::bigint,
    coalesce(rag_evals.eval_passed, 0)::bigint,
    coalesce(candidate_stats.candidates_created, 0)::bigint
  from days
  left join rag_runs using (bucket_date)
  left join rag_feedback using (bucket_date)
  left join rag_evals using (bucket_date)
  left join candidate_stats using (bucket_date)
  order by days.bucket_date;
$$;

revoke all on function public.get_rag_ops_trend(integer) from public, anon, authenticated;
grant execute on function public.get_rag_ops_trend(integer) to service_role;

commit;
