begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_function(
  'public',
  'search_ai_tool_run_logs',
  array['integer', 'text', 'text'],
  'central tool-run log search function exists'
);
select has_function(
  'public',
  'get_ai_ops_alerts',
  array['integer'],
  'AI Ops alert evaluation function exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.search_ai_tool_run_logs(integer, text, text)',
    'execute'
  ),
  'anon cannot search tool-run logs'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.search_ai_tool_run_logs(integer, text, text)',
    'execute'
  ),
  'authenticated users cannot search tool-run logs'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.search_ai_tool_run_logs(integer, text, text)',
    'execute'
  ),
  'service role can search tool-run logs'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_ai_ops_alerts(integer)',
    'execute'
  ),
  'anon cannot evaluate AI Ops alerts'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_ai_ops_alerts(integer)',
    'execute'
  ),
  'authenticated users cannot evaluate AI Ops alerts'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_ai_ops_alerts(integer)',
    'execute'
  ),
  'service role can evaluate AI Ops alerts'
);

insert into public.conversation_sessions (id, anonymous_id, title)
values (
  '70000000-0000-4000-8000-000000000091',
  'ai-ops-alert-test',
  'AI Ops alert test'
);

insert into public.ai_tool_runs (
  id,
  session_id,
  tool_name,
  status,
  input_json,
  output_summary,
  source_label,
  duration_ms,
  error_code,
  request_id,
  completed_at,
  created_at
)
select
  ('73000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '70000000-0000-4000-8000-000000000091'::uuid,
  'test_observability_tool',
  'failed'::public.tool_run_status,
  '{"secret":"must-not-be-returned"}'::jsonb,
  '{"private":"must-not-be-returned"}'::jsonb,
  '测试来源',
  250,
  'TEST_FAILURE',
  ('74000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  timezone('utc', now()),
  timezone('utc', now())
from generate_series(1, 20) as series;

select is(
  (
    select count(*)
    from public.search_ai_tool_run_logs(
      10,
      'failed',
      'test_observability_tool'
    )
  ),
  10::bigint,
  'log search applies a bounded limit and exact filters'
);
select is(
  (
    select count(*)
    from public.search_ai_tool_run_logs(
      10,
      'succeeded',
      'test_observability_tool'
    )
  ),
  0::bigint,
  'log search does not silently widen a status filter'
);
select is(
  (
    select count(*)
    from information_schema.parameters
    where specific_schema = 'public'
      and specific_name like 'search_ai_tool_run_logs_%'
      and parameter_mode = 'OUT'
      and parameter_name in ('input_json', 'output_summary')
  ),
  0::bigint,
  'log search return shape excludes tool input and output payloads'
);
select is(
  (
    select count(*)
    from public.get_ai_ops_alerts(1)
  ),
  6::bigint,
  'alert evaluation returns the six documented signals'
);
select is(
  (
    select alerts.state
    from public.get_ai_ops_alerts(1) alerts
    where alerts.alert_key = 'tool_failure_rate'
  ),
  'alert'::text,
  'tool failure threshold opens an alert with enough samples'
);
select is(
  (
    select alerts.sample_count
    from public.get_ai_ops_alerts(1) alerts
    where alerts.alert_key = 'tool_failure_rate'
  ) >= 20,
  true,
  'tool failure alert reports its sample size'
);
select lives_ok(
  $$select * from public.get_ai_ops_alerts(720)$$,
  'maximum alert window is accepted'
);

select * from finish();
rollback;
