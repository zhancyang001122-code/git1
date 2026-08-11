begin;

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
    where runs.created_at >= parameters.measured_at - make_interval(hours => parameters.bounded_hours)
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

revoke all on function public.get_ai_ops_dashboard(integer) from public, anon, authenticated;
grant execute on function public.get_ai_ops_dashboard(integer) to service_role;

commit;
