begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;

select plan(17);

select has_column(
  'public',
  'conversation_messages',
  'first_token_ms',
  'assistant messages store server-side first-token latency'
);
select has_column(
  'public',
  'conversation_messages',
  'estimated_cost_cny',
  'assistant messages store auditable estimated cost'
);
select has_column(
  'public',
  'conversation_messages',
  'pricing_effective_from',
  'assistant messages store the pricing version date'
);
select is(
  (select count(*) from public.get_ai_ops_alerts(1)),
  6::bigint,
  'alert evaluation returns six documented signals'
);
select set_eq(
  $$select alert_key from public.get_ai_ops_alerts(1)$$,
  $$values
    ('tool_failure_rate'::text),
    ('rag_no_result_rate'::text),
    ('knowledge_index_backlog'::text),
    ('rag_eval_failure_rate'::text),
    ('first_token_p95'::text),
    ('session_cost'::text)$$,
  'alert keys include latency and session cost SLOs'
);

insert into public.conversation_sessions (id, anonymous_id, title)
select
  ('70000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'ai-model-slo-' || series,
  'AI model SLO test'
from generate_series(201, 205) as series;

insert into public.conversation_messages (
  session_id,
  role,
  content,
  model_name,
  input_tokens,
  output_tokens,
  first_token_ms,
  estimated_cost_cny,
  pricing_effective_from,
  created_at
)
select
  '70000000-0000-4000-8000-000000000201'::uuid,
  'assistant',
  '测试回答',
  'qwen-plus',
  1000,
  100,
  7000,
  0.001,
  '2026-08-12'::date,
  timezone('utc', now())
from generate_series(1, 20);

insert into public.conversation_messages (
  session_id,
  role,
  content,
  model_name,
  input_tokens,
  output_tokens,
  first_token_ms,
  estimated_cost_cny,
  pricing_effective_from,
  created_at
)
select
  ('70000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'assistant',
  '成本测试回答',
  'qwen-plus',
  1000,
  100,
  100,
  case when series = 205 then 0.11 else 0.01 end,
  '2026-08-12'::date,
  timezone('utc', now())
from generate_series(202, 205) as series;

select is(
  (select state from public.get_ai_ops_alerts(1) where alert_key = 'first_token_p95'),
  'alert'::text,
  'first-token P95 alerts above six seconds with enough samples'
);
select is(
  (select metric_value from public.get_ai_ops_alerts(1) where alert_key = 'first_token_p95'),
  7000::numeric,
  'first-token alert reports the computed P95 in milliseconds'
);
select is(
  (select threshold_value from public.get_ai_ops_alerts(1) where alert_key = 'first_token_p95'),
  6000::numeric,
  'first-token threshold is six seconds'
);
select isnt(
  (select state from public.get_ai_ops_alerts(1) where alert_key = 'session_cost'),
  'ok'::text,
  'a session above the cost threshold is never reported healthy; older unpriced production rows may keep coverage insufficient'
);
select is(
  (select metric_value from public.get_ai_ops_alerts(1) where alert_key = 'session_cost'),
  0.11::numeric,
  'session-cost alert reports the maximum estimated session cost'
);
select is(
  (select threshold_value from public.get_ai_ops_alerts(1) where alert_key = 'session_cost'),
  0.1::numeric,
  'session-cost threshold is one tenth of a yuan'
);
insert into public.conversation_sessions (id, anonymous_id, title)
values (
  '70000000-0000-4000-8000-000000000206',
  'ai-model-slo-unpriced',
  'Unpriced session test'
);
insert into public.conversation_messages (
  session_id,
  role,
  content,
  model_name,
  input_tokens,
  output_tokens,
  first_token_ms,
  created_at
) values (
  '70000000-0000-4000-8000-000000000206',
  'assistant',
  '缺少价格覆盖',
  'qwen-plus',
  1000,
  100,
  100,
  timezone('utc', now())
);
select is(
  (select state from public.get_ai_ops_alerts(1) where alert_key = 'session_cost'),
  'insufficient_data'::text,
  'partial session pricing coverage is never reported as normal or alert-ready'
);
select lives_ok(
  $$insert into public.ai_ops_incidents (
      alert_key,
      severity,
      title,
      metric_value,
      threshold_value,
      sample_count,
      detail
    ) values (
      'first_token_p95',
      'warning',
      '首 Token P95',
      7000,
      6000,
      24,
      '测试事故'
    )$$,
  'incident constraint accepts the first-token signal'
);
select lives_ok(
  $$insert into public.ai_ops_incidents (
      alert_key,
      severity,
      title,
      metric_value,
      threshold_value,
      sample_count,
      detail
    ) values (
      'session_cost',
      'warning',
      '单会话成本',
      0.11,
      0.1,
      5,
      '测试事故'
    )$$,
  'incident constraint accepts the session-cost signal'
);
select throws_ok(
  $$insert into public.conversation_messages (
      session_id,
      role,
      content,
      first_token_ms
    ) values (
      '70000000-0000-4000-8000-000000000201',
      'assistant',
      '无效延迟',
      -1
    )$$,
  '23514',
  null,
  'negative first-token latency is rejected'
);
select throws_ok(
  $$insert into public.conversation_messages (
      session_id,
      role,
      content,
      estimated_cost_cny
    ) values (
      '70000000-0000-4000-8000-000000000201',
      'assistant',
      '无效成本',
      -0.01
    )$$,
  '23514',
  null,
  'negative estimated cost is rejected'
);
select is(
  (
    select count(*)
    from information_schema.parameters
    where specific_schema = 'public'
      and specific_name like 'get_ai_ops_alerts_%'
      and parameter_mode = 'OUT'
      and parameter_name in ('content', 'structured_payload')
  ),
  0::bigint,
  'alert RPC does not expose conversation content or structured payloads'
);

select * from finish();
rollback;
