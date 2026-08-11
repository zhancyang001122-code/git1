begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_function(
  'public',
  'get_ai_model_usage',
  array['integer'],
  'AI model usage function exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_ai_model_usage(integer)',
    'execute'
  ),
  'anon cannot read model usage'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_ai_model_usage(integer)',
    'execute'
  ),
  'authenticated users cannot read model usage'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_ai_model_usage(integer)',
    'execute'
  ),
  'service role can read model usage'
);

insert into public.conversation_sessions (id, anonymous_id, title)
values (
  '70000000-0000-4000-8000-000000000090',
  'ai-model-cost-test',
  'AI model cost test'
);

insert into public.conversation_messages (
  id,
  session_id,
  role,
  content,
  model_name,
  input_tokens,
  output_tokens
) values
(
  '72000000-0000-4000-8000-000000000090',
  '70000000-0000-4000-8000-000000000090',
  'assistant',
  '',
  'qwen-plus',
  2000,
  1000
),
(
  '72000000-0000-4000-8000-000000000091',
  '70000000-0000-4000-8000-000000000090',
  'assistant',
  '',
  'qwen-plus',
  2000,
  1000
),
(
  '72000000-0000-4000-8000-000000000092',
  '70000000-0000-4000-8000-000000000090',
  'assistant',
  '',
  'test-qwen-missing-usage',
  null,
  null
),
(
  '72000000-0000-4000-8000-000000000093',
  '70000000-0000-4000-8000-000000000090',
  'user',
  'not billable as model output',
  'qwen-plus',
  2000,
  1000
);

select is(
  (
    select usage.requests
    from public.get_ai_model_usage(168) usage
    where usage.model_name = 'qwen-plus'
      and usage.input_tokens = 2000
      and usage.output_tokens = 1000
  ),
  2::bigint,
  'identical per-request usage is grouped without message content'
);
select is(
  (
    select usage.requests
    from public.get_ai_model_usage(168) usage
    where usage.model_name = 'test-qwen-missing-usage'
      and usage.input_tokens is null
      and usage.output_tokens is null
  ),
  1::bigint,
  'missing model usage remains visibly unpriced'
);
select is(
  (
    select sum(usage.requests)
    from public.get_ai_model_usage(168) usage
    where usage.model_name = 'qwen-plus'
      and usage.input_tokens = 2000
      and usage.output_tokens = 1000
  ),
  2::numeric,
  'non-assistant messages are excluded'
);
select lives_ok(
  $$select * from public.get_ai_model_usage(720)$$,
  'bounded maximum window is accepted'
);

select * from finish();
rollback;
