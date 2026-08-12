begin;

create or replace function public.search_ai_tool_run_logs(
  p_limit integer default 20,
  p_status text default null,
  p_tool_name text default null
)
returns table (
  id uuid,
  tool_name text,
  status text,
  source_label text,
  duration_ms integer,
  error_code text,
  request_id uuid,
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select
    runs.id,
    runs.tool_name,
    runs.status::text,
    runs.source_label,
    runs.duration_ms,
    runs.error_code,
    runs.request_id,
    runs.created_at
  from public.ai_tool_runs runs
  where runs.status in ('succeeded', 'failed', 'timed_out')
    and (
      nullif(trim(p_status), '') is null
      or runs.status::text = trim(p_status)
    )
    and (
      nullif(trim(p_tool_name), '') is null
      or runs.tool_name = trim(p_tool_name)
    )
  order by runs.created_at desc, runs.id desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create or replace function public.get_ai_ops_alerts(
  p_window_hours integer default 24
)
returns table (
  alert_key text,
  severity text,
  state text,
  title text,
  metric_value numeric,
  threshold_value numeric,
  sample_count bigint,
  detail text,
  measured_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  with parameters as (
    select
      greatest(1, least(coalesce(p_window_hours, 24), 720)) as bounded_hours,
      timezone('utc', now()) as measured_at
  ),
  tool_stats as (
    select
      count(*)::bigint as total,
      count(*) filter (
        where runs.status in ('failed', 'timed_out')
      )::bigint as failures
    from public.ai_tool_runs runs, parameters
    where runs.status in ('succeeded', 'failed', 'timed_out')
      and runs.created_at >= parameters.measured_at
        - make_interval(hours => parameters.bounded_hours)
  ),
  rag_stats as (
    select
      count(*)::bigint as total,
      count(*) filter (
        where runs.status = 'succeeded'
          and runs.output_summary ->> 'resultCount' = '0'
      )::bigint as no_results
    from public.ai_tool_runs runs, parameters
    where runs.tool_name = 'search_knowledge'
      and runs.status in ('succeeded', 'failed', 'timed_out')
      and runs.created_at >= parameters.measured_at
        - make_interval(hours => parameters.bounded_hours)
  ),
  queue_stats as (
    select
      count(*) filter (where jobs.status = 'failed')::bigint as failed_jobs,
      count(*) filter (
        where (
          jobs.status in ('pending', 'retrying')
          and jobs.available_at <= parameters.measured_at - interval '15 minutes'
        ) or (
          jobs.status = 'processing'
          and jobs.lease_expires_at <= parameters.measured_at
        )
      )::bigint as stale_jobs,
      count(*) filter (
        where jobs.status in ('pending', 'processing', 'retrying', 'failed')
      )::bigint as tracked_jobs
    from public.knowledge_index_jobs jobs, parameters
  ),
  rag_eval_stats as (
    select
      count(*)::bigint as total,
      count(*) filter (where runs.passed = false)::bigint as failures
    from public.ai_eval_runs runs
    join public.ai_eval_cases cases on cases.id = runs.case_id
    cross join parameters
    where cases.category in ('rag', 'no_answer')
      and runs.created_at >= parameters.measured_at
        - make_interval(hours => parameters.bounded_hours)
  )
  select
    'tool_failure_rate'::text,
    'warning'::text,
    case
      when tool_stats.total < 20 then 'insufficient_data'
      when tool_stats.failures * 100.0 / tool_stats.total > 5 then 'alert'
      else 'ok'
    end,
    '工具失败率'::text,
    case
      when tool_stats.total = 0 then 0::numeric
      else round(tool_stats.failures * 100.0 / tool_stats.total, 2)
    end,
    5::numeric,
    tool_stats.total,
    case
      when tool_stats.total < 20 then format(
        '样本不足：当前 %s 次，至少需要 20 次终态工具调用',
        tool_stats.total
      )
      else format(
        '%s / %s 次终态工具调用失败或超时',
        tool_stats.failures,
        tool_stats.total
      )
    end,
    parameters.measured_at
  from parameters, tool_stats

  union all

  select
    'rag_no_result_rate'::text,
    'warning'::text,
    case
      when rag_stats.total < 10 then 'insufficient_data'
      when rag_stats.no_results * 100.0 / rag_stats.total > 20 then 'alert'
      else 'ok'
    end,
    'RAG 零结果率'::text,
    case
      when rag_stats.total = 0 then 0::numeric
      else round(rag_stats.no_results * 100.0 / rag_stats.total, 2)
    end,
    20::numeric,
    rag_stats.total,
    case
      when rag_stats.total < 10 then format(
        '样本不足：当前 %s 次，至少需要 10 次检索',
        rag_stats.total
      )
      else format(
        '%s / %s 次知识检索返回零结果',
        rag_stats.no_results,
        rag_stats.total
      )
    end,
    parameters.measured_at
  from parameters, rag_stats

  union all

  select
    'knowledge_index_backlog'::text,
    'critical'::text,
    case
      when queue_stats.failed_jobs + queue_stats.stale_jobs > 0 then 'alert'
      else 'ok'
    end,
    '知识索引积压'::text,
    (queue_stats.failed_jobs + queue_stats.stale_jobs)::numeric,
    0::numeric,
    queue_stats.tracked_jobs,
    format(
      '%s 个失败任务，%s 个超时或等待超过 15 分钟的任务',
      queue_stats.failed_jobs,
      queue_stats.stale_jobs
    ),
    parameters.measured_at
  from parameters, queue_stats

  union all

  select
    'rag_eval_failure_rate'::text,
    'critical'::text,
    case
      when rag_eval_stats.total < 5 then 'insufficient_data'
      when rag_eval_stats.failures * 100.0 / rag_eval_stats.total > 10 then 'alert'
      else 'ok'
    end,
    'RAG 评测失败率'::text,
    case
      when rag_eval_stats.total = 0 then 0::numeric
      else round(rag_eval_stats.failures * 100.0 / rag_eval_stats.total, 2)
    end,
    10::numeric,
    rag_eval_stats.total,
    case
      when rag_eval_stats.total < 5 then format(
        '样本不足：当前 %s 次，至少需要 5 次 RAG 评测',
        rag_eval_stats.total
      )
      else format(
        '%s / %s 次 RAG 或拒答评测失败',
        rag_eval_stats.failures,
        rag_eval_stats.total
      )
    end,
    parameters.measured_at
  from parameters, rag_eval_stats
  order by 1;
$$;

revoke all on function public.search_ai_tool_run_logs(integer, text, text)
from public, anon, authenticated;
grant execute on function public.search_ai_tool_run_logs(integer, text, text)
to service_role;

revoke all on function public.get_ai_ops_alerts(integer)
from public, anon, authenticated;
grant execute on function public.get_ai_ops_alerts(integer)
to service_role;

commit;
