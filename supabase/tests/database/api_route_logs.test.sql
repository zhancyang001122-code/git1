begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select has_table('public', 'api_route_logs', 'API route log table exists');
select has_function(
  'public',
  'search_api_route_logs',
  array['integer', 'text', 'integer'],
  'bounded API route log search exists'
);
select hasnt_column(
  'public',
  'api_route_logs',
  'request_body',
  'request bodies are never stored'
);
select hasnt_column(
  'public',
  'api_route_logs',
  'query_string',
  'query strings are never stored'
);
select hasnt_column(
  'public',
  'api_route_logs',
  'client_ip',
  'client IPs are never stored'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.api_route_logs'::regclass
  ),
  'API route logs have RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.api_route_logs', 'select'),
  'anon cannot read API route logs'
);
select ok(
  not has_table_privilege('authenticated', 'public.api_route_logs', 'select'),
  'authenticated users cannot read API route logs'
);
select ok(
  has_table_privilege('service_role', 'public.api_route_logs', 'select'),
  'service role can read API route logs'
);
select ok(
  has_table_privilege('service_role', 'public.api_route_logs', 'insert'),
  'service role can insert API route logs'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.search_api_route_logs(integer, text, integer)',
    'execute'
  ),
  'anon cannot search API route logs'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.search_api_route_logs(integer, text, integer)',
    'execute'
  ),
  'authenticated users cannot search API route logs'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.search_api_route_logs(integer, text, integer)',
    'execute'
  ),
  'service role can search API route logs'
);

truncate table public.api_route_logs;

insert into public.api_route_logs (
  route_key,
  method,
  status_code,
  duration_ms,
  request_id,
  error_code,
  created_at
) values
  ('/api/health', 'GET', 200, 12, gen_random_uuid(), null, now() - interval '2 seconds'),
  ('/api/maps/nearby', 'POST', 502, 40, gen_random_uuid(), 'AMAP_UPSTREAM_FAILED', now() - interval '1 second');

select is(
  (select count(*)::integer from public.search_api_route_logs(20, null, null)),
  2,
  'unfiltered search returns stored logs'
);
select is(
  (select count(*)::integer from public.search_api_route_logs(20, 'POST', null)),
  1,
  'method filter is applied'
);
select is(
  (select count(*)::integer from public.search_api_route_logs(20, null, 5)),
  1,
  'status-class filter is applied'
);
select is(
  (select route_key from public.search_api_route_logs(1, null, null)),
  '/api/maps/nearby',
  'results are newest first and limit is applied'
);
select throws_ok(
  $$
    insert into public.api_route_logs (
      route_key, method, status_code, duration_ms, request_id
    ) values (
      '/private/not-api', 'GET', 200, 1, gen_random_uuid()
    )
  $$,
  '23514',
  null,
  'non-API route keys are rejected'
);
select throws_ok(
  $$
    insert into public.api_route_logs (
      route_key, method, status_code, duration_ms, request_id
    ) values (
      '/api/health', 'GET', 200, 300001, gen_random_uuid()
    )
  $$,
  '23514',
  null,
  'unbounded durations are rejected'
);

select * from finish();
rollback;
