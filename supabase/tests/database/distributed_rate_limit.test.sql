begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select has_table(
  'public',
  'api_rate_limit_windows',
  'shared rate-limit table exists'
);
select has_function(
  'public',
  'check_api_rate_limit',
  array['text', 'text', 'integer', 'integer'],
  'atomic shared rate-limit function exists'
);
select has_column(
  'public',
  'api_rate_limit_windows',
  'key_hash',
  'only a client-key hash is stored'
);
select hasnt_column(
  'public',
  'api_rate_limit_windows',
  'raw_key',
  'raw client key is never stored'
);
select hasnt_column(
  'public',
  'api_rate_limit_windows',
  'client_ip',
  'client IP is never stored directly'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.api_rate_limit_windows'::regclass
  ),
  'shared rate-limit table has RLS enabled'
);
select ok(
  not has_table_privilege(
    'anon',
    'public.api_rate_limit_windows',
    'select'
  ),
  'anon cannot read shared counters'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.api_rate_limit_windows',
    'select'
  ),
  'authenticated users cannot read shared counters'
);
select ok(
  has_table_privilege(
    'service_role',
    'public.api_rate_limit_windows',
    'select'
  ),
  'service role can read shared counters'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.check_api_rate_limit(text, text, integer, integer)',
    'execute'
  ),
  'anon cannot call shared rate limiting'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.check_api_rate_limit(text, text, integer, integer)',
    'execute'
  ),
  'authenticated users cannot call shared rate limiting'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.check_api_rate_limit(text, text, integer, integer)',
    'execute'
  ),
  'service role can call shared rate limiting'
);

select is(
  (
    select allowed
    from public.check_api_rate_limit(
      'test_chat',
      repeat('a', 64),
      2,
      60
    )
  ),
  true,
  'first request is allowed'
);
select is(
  (
    select remaining
    from public.check_api_rate_limit(
      'test_chat',
      repeat('a', 64),
      2,
      60
    )
  ),
  0,
  'second request consumes the remaining quota'
);
select is(
  (
    select allowed
    from public.check_api_rate_limit(
      'test_chat',
      repeat('a', 64),
      2,
      60
    )
  ),
  false,
  'third request is denied atomically'
);
select ok(
  (
    select retry_after_seconds
    from public.check_api_rate_limit(
      'test_chat',
      repeat('b', 64),
      1,
      60
    )
  ) between 1 and 60,
  'retry-after stays inside the fixed window'
);
select is(
  (
    select request_count
    from public.api_rate_limit_windows
    where scope = 'test_chat'
      and key_hash = repeat('a', 64)
  ),
  3,
  'the shared counter records all attempts'
);
select throws_ok(
  $$
    select *
    from public.check_api_rate_limit(
      'test_chat',
      'raw-client-ip',
      2,
      60
    )
  $$,
  '22023',
  'Invalid rate limit key hash',
  'raw client identifiers are rejected'
);

select * from finish();
rollback;
