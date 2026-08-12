begin;

alter table public.conversation_messages
  add column first_token_ms integer
    check (first_token_ms is null or first_token_ms between 0 and 300000),
  add column estimated_cost_cny numeric(12, 6)
    check (
      estimated_cost_cny is null
      or estimated_cost_cny between 0 and 100000
    ),
  add column pricing_effective_from date,
  add constraint conversation_messages_cost_provenance_check check (
    (estimated_cost_cny is null and pricing_effective_from is null)
    or (estimated_cost_cny is not null and pricing_effective_from is not null)
  ),
  add constraint conversation_messages_ai_metrics_role_check check (
    role = 'assistant'
    or (
      first_token_ms is null
      and estimated_cost_cny is null
      and pricing_effective_from is null
    )
  );

create index conversation_messages_first_token_created_idx
  on public.conversation_messages (created_at desc, first_token_ms)
  where role = 'assistant' and first_token_ms is not null;
create index conversation_messages_session_cost_idx
  on public.conversation_messages (session_id, created_at desc)
  where role = 'assistant';

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
  ),
  first_token_stats as (
    select
      count(messages.first_token_ms)::bigint as measured,
      percentile_disc(0.95) within group (
        order by messages.first_token_ms
      )::numeric as p95_ms
    from public.conversation_messages messages, parameters
    where messages.role = 'assistant'
      and messages.first_token_ms is not null
      and messages.created_at >= parameters.measured_at
        - make_interval(hours => parameters.bounded_hours)
  ),
  session_costs as (
    select
      messages.session_id,
      count(*)::bigint as requests,
      count(messages.estimated_cost_cny)::bigint as priced_requests,
      coalesce(sum(messages.estimated_cost_cny), 0)::numeric as cost_cny
    from public.conversation_messages messages, parameters
    where messages.role = 'assistant'
      and messages.created_at >= parameters.measured_at
        - make_interval(hours => parameters.bounded_hours)
    group by messages.session_id
  ),
  session_cost_stats as (
    select
      count(*)::bigint as total_sessions,
      count(*) filter (
        where requests = priced_requests and requests > 0
      )::bigint as priced_sessions,
      coalesce(max(cost_cny) filter (
        where requests = priced_requests and requests > 0
      ), 0)::numeric as max_cost_cny
    from session_costs
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

  union all

  select
    'first_token_p95'::text,
    'warning'::text,
    case
      when first_token_stats.measured < 20 then 'insufficient_data'
      when first_token_stats.p95_ms > 6000 then 'alert'
      else 'ok'
    end,
    '首 Token P95'::text,
    coalesce(first_token_stats.p95_ms, 0)::numeric,
    6000::numeric,
    first_token_stats.measured,
    case
      when first_token_stats.measured < 20 then format(
        '样本不足：当前 %s 次，至少需要 20 次有文本输出的模型回答',
        first_token_stats.measured
      )
      else format(
        '服务端从收到请求到首个可见回答文本的 P95 为 %s ms',
        first_token_stats.p95_ms
      )
    end,
    parameters.measured_at
  from parameters, first_token_stats

  union all

  select
    'session_cost'::text,
    'warning'::text,
    case
      when session_cost_stats.priced_sessions < 5
        or session_cost_stats.priced_sessions < session_cost_stats.total_sessions
        then 'insufficient_data'
      when session_cost_stats.max_cost_cny > 0.1 then 'alert'
      else 'ok'
    end,
    '单会话成本估算'::text,
    round(session_cost_stats.max_cost_cny, 6),
    0.1::numeric,
    session_cost_stats.priced_sessions,
    case
      when session_cost_stats.priced_sessions < 5
        or session_cost_stats.priced_sessions < session_cost_stats.total_sessions
        then format(
        '覆盖不足：%s / %s 个会话完整记录了 Token 与价格版本，至少需要 5 个',
        session_cost_stats.priced_sessions,
        session_cost_stats.total_sessions
      )
      else format(
        '完整计价会话中的最高模型成本估算为 %s 元；覆盖 %s / %s 个会话，不等同于账单',
        round(session_cost_stats.max_cost_cny, 6),
        session_cost_stats.priced_sessions,
        session_cost_stats.total_sessions
      )
    end,
    parameters.measured_at
  from parameters, session_cost_stats
  order by 1;
$$;

alter table public.ai_ops_incidents
  drop constraint ai_ops_incidents_alert_key_check;
alter table public.ai_ops_incidents
  add constraint ai_ops_incidents_alert_key_check check (
    alert_key in (
      'tool_failure_rate',
      'rag_no_result_rate',
      'knowledge_index_backlog',
      'rag_eval_failure_rate',
      'first_token_p95',
      'session_cost'
    )
  );

revoke all on function public.get_ai_ops_alerts(integer)
from public, anon, authenticated;
grant execute on function public.get_ai_ops_alerts(integer)
to service_role;

commit;
