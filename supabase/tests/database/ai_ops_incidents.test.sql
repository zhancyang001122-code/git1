begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;
select plan(36);

select has_table('public', 'ai_ops_incidents', 'incident table exists');
select has_table('public', 'ai_ops_incident_events', 'incident event table exists');
select has_function('public', 'sync_ai_ops_incidents', array['integer'], 'incident sync exists');
select has_function('public', 'search_ai_ops_incidents', array['integer'], 'incident search exists');
select has_function(
  'public',
  'transition_ai_ops_incident',
  array['uuid', 'text', 'text', 'text'],
  'incident transition exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ai_ops_incidents'::regclass),
  'incident table has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ai_ops_incident_events'::regclass),
  'incident event table has RLS enabled'
);
select ok(not has_table_privilege('anon', 'public.ai_ops_incidents', 'select'), 'anon cannot read incidents');
select ok(not has_table_privilege('authenticated', 'public.ai_ops_incidents', 'select'), 'users cannot read incidents');
select ok(has_table_privilege('service_role', 'public.ai_ops_incidents', 'select'), 'service role can read incidents');
select ok(not has_table_privilege('service_role', 'public.ai_ops_incident_events', 'update'), 'service role cannot rewrite audit events');
select ok(not has_table_privilege('service_role', 'public.ai_ops_incident_events', 'delete'), 'service role cannot delete audit events');
select ok(not has_function_privilege('anon', 'public.sync_ai_ops_incidents(integer)', 'execute'), 'anon cannot sync incidents');
select ok(not has_function_privilege('authenticated', 'public.search_ai_ops_incidents(integer)', 'execute'), 'users cannot search incidents');
select ok(has_function_privilege('service_role', 'public.transition_ai_ops_incident(uuid, text, text, text)', 'execute'), 'service role can transition incidents');

insert into public.conversation_sessions (id, anonymous_id, title)
values (
  '70000000-0000-4000-8000-000000000092',
  'ai-ops-incident-test',
  'AI Ops incident test'
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
  ('75000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '70000000-0000-4000-8000-000000000092'::uuid,
  'test_incident_tool',
  'failed'::public.tool_run_status,
  '{}'::jsonb,
  null,
  '测试来源',
  250,
  'TEST_INCIDENT_FAILURE',
  ('76000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  timezone('utc', now()),
  timezone('utc', now())
from generate_series(1, 20) as series;

select is((select opened_count from public.sync_ai_ops_incidents(1)), 1, 'first sync opens one incident');
select is((select active_count from public.sync_ai_ops_incidents(1)), 1, 'repeated sync keeps one active incident');
select is(
  (select count(*)::integer from public.ai_ops_incidents where alert_key = 'tool_failure_rate' and status in ('open', 'acknowledged')),
  1,
  'only one active incident exists per signal'
);
select is(
  (select count(*)::integer from public.ai_ops_incident_events where event_type = 'opened'),
  1,
  'repeated sync does not duplicate opened events'
);
select throws_ok(
  $$select * from public.transition_ai_ops_incident(
    (select id from public.ai_ops_incidents where alert_key = 'tool_failure_rate' and status = 'open'),
    'resolve',
    'portfolio_admin',
    '尝试跳过认领'
  )$$,
  '22023',
  'Incident must be acknowledged before resolution',
  'open incidents cannot skip acknowledgement'
);
select is(
  (select status from public.transition_ai_ops_incident(
    (select id from public.ai_ops_incidents where alert_key = 'tool_failure_rate' and status = 'open'),
    'acknowledge',
    'portfolio_admin',
    '开始排查工具失败'
  )),
  'acknowledged'::text,
  'admin can acknowledge an open incident'
);
select is(
  (select count(*)::integer from public.ai_ops_incident_events where event_type = 'acknowledged'),
  1,
  'acknowledgement writes one audit event'
);
select lives_ok(
  $$select * from public.transition_ai_ops_incident(
    (select id from public.ai_ops_incidents where alert_key = 'tool_failure_rate' and status = 'acknowledged'),
    'acknowledge',
    'portfolio_admin',
    '重复请求'
  )$$,
  'repeated acknowledgement is idempotent'
);
select is(
  (select count(*)::integer from public.ai_ops_incident_events where event_type = 'acknowledged'),
  1,
  'idempotent acknowledgement does not duplicate audit events'
);
select throws_ok(
  $$select * from public.transition_ai_ops_incident(
    (select id from public.ai_ops_incidents where alert_key = 'tool_failure_rate' and status = 'acknowledged'),
    'resolve',
    'portfolio_admin',
    null
  )$$,
  '22023',
  'Resolution note is required',
  'manual resolution requires a note'
);
select is(
  (select status from public.transition_ai_ops_incident(
    (select id from public.ai_ops_incidents where alert_key = 'tool_failure_rate' and status = 'acknowledged'),
    'resolve',
    'portfolio_admin',
    '已修复并完成回归'
  )),
  'resolved'::text,
  'admin can resolve an acknowledged incident'
);
select is(
  (select count(*)::integer from public.ai_ops_incident_events where event_type = 'resolved'),
  1,
  'manual resolution writes one audit event'
);
select is(
  (select event_count::integer from public.search_ai_ops_incidents(20) where alert_key = 'tool_failure_rate' order by updated_at desc limit 1),
  3,
  'incident search reports the immutable event count'
);

select is((select opened_count from public.sync_ai_ops_incidents(1)), 1, 'an active signal reopens a new incident after manual resolution');
delete from public.ai_tool_runs where tool_name = 'test_incident_tool';
select is((select recovered_count from public.sync_ai_ops_incidents(1)), 1, 'signal recovery auto-resolves the active incident');
select is(
  (select count(*)::integer from public.ai_ops_incidents where alert_key = 'tool_failure_rate' and status in ('open', 'acknowledged')),
  0,
  'no active incident remains after recovery'
);
select is(
  (select count(*)::integer from public.ai_ops_incident_events where event_type = 'recovered'),
  1,
  'automatic recovery writes one audit event'
);
select throws_ok(
  $$select * from public.transition_ai_ops_incident(
    (select id from public.ai_ops_incidents where alert_key = 'tool_failure_rate' order by updated_at desc limit 1),
    'acknowledge',
    'portfolio_admin',
    null
  )$$,
  '22023',
  'Resolved incident cannot be acknowledged',
  'resolved incidents cannot move backwards'
);
select throws_ok(
  $$select * from public.transition_ai_ops_incident(
    gen_random_uuid(),
    'acknowledge',
    'portfolio_admin',
    null
  )$$,
  'P0002',
  'Incident not found',
  'missing incidents fail explicitly'
);
select is(
  (select count(*)::integer from public.search_ai_ops_incidents(1)),
  1,
  'incident search applies a bounded limit'
);
select ok(
  (select resolution_note is not null from public.ai_ops_incidents where alert_key = 'tool_failure_rate' and status = 'resolved' order by updated_at desc limit 1),
  'resolved incidents retain a resolution note'
);

select * from finish();
rollback;
