begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select has_function(
  'public',
  'get_housing_import_status',
  array['uuid'],
  'housing import status function exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_housing_import_status(uuid)',
    'execute'
  ),
  'anon cannot execute import status'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_housing_import_status(uuid)',
    'execute'
  ),
  'authenticated cannot execute import status'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_housing_import_status(uuid)',
    'execute'
  ),
  'service role can execute import status'
);

insert into public.housing_dataset_releases (
  id,
  dataset_period,
  source_label,
  disclaimer,
  expected_count,
  content_checksum
) values (
  '30000000-0000-0000-0000-000000000001',
  '2024-12',
  '测试历史快照',
  '仅供测试',
  1,
  repeat('b', 64)
);

select is(
  (
    select expected_count
    from public.get_housing_import_status('30000000-0000-0000-0000-000000000001')
  ),
  1,
  'status reports expected count'
);
select is(
  (
    select actual_count
    from public.get_housing_import_status('30000000-0000-0000-0000-000000000001')
  ),
  0,
  'status reports actual count'
);
select ok(
  (
    select table_bytes > 0
    from public.get_housing_import_status('30000000-0000-0000-0000-000000000001')
  ),
  'status reports table bytes'
);
select ok(
  (
    select index_bytes > 0
    from public.get_housing_import_status('30000000-0000-0000-0000-000000000001')
  ),
  'status reports index bytes'
);
select ok(
  (
    select database_bytes > table_bytes + index_bytes
    from public.get_housing_import_status('30000000-0000-0000-0000-000000000001')
  ),
  'status reports database bytes'
);
select is(
  (
    select count(*)
    from public.get_housing_import_status('30000000-0000-0000-0000-000000000099')
  ),
  0::bigint,
  'unknown release returns no status row'
);

select * from finish();
rollback;
