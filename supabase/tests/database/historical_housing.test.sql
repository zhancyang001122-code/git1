begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

select has_table('public', 'housing_dataset_releases', 'release table exists');
select has_table('public', 'historical_houses', 'historical house table exists');
select has_column('public', 'historical_houses', 'location', 'location column exists');
select has_column('public', 'historical_houses', 'bedrooms', 'bedrooms column exists');
select hasnt_column('public', 'historical_houses', 'raw', 'raw payload is excluded');
select hasnt_column('public', 'historical_houses', 'contact_phone', 'contact details are excluded');
select hasnt_column('public', 'historical_houses', 'internal_id', 'internal id is excluded');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.housing_dataset_releases'::regclass),
  'release table has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.historical_houses'::regclass),
  'historical house table has RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.historical_houses', 'select'),
  'anon cannot read historical houses directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.historical_houses', 'select'),
  'authenticated cannot read historical houses directly'
);
select ok(
  has_table_privilege('service_role', 'public.historical_houses', 'select'),
  'service role can read historical houses'
);

insert into public.housing_dataset_releases (
  id,
  dataset_period,
  source_label,
  disclaimer,
  expected_count,
  content_checksum
) values (
  '10000000-0000-0000-0000-000000000001',
  '2024-11',
  '2024年11月杭州租房历史快照',
  '仅供历史房源参考，不代表当前仍可出租或当前价格',
  3,
  repeat('a', 64)
);

insert into public.historical_houses (
  id,
  release_id,
  dataset_period,
  source_key_hash,
  title,
  city,
  community,
  price_monthly,
  rent_type,
  layout,
  bedrooms,
  area_sqm,
  longitude,
  latitude,
  source_url
) values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '2024-11',
    repeat('1', 64),
    '武林广场一居室',
    '杭州',
    '武林小区',
    3200,
    '整租',
    '1室1厅',
    1,
    42.5,
    120.155100,
    30.274100,
    'https://example.com/house/1'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '2024-11',
    repeat('2', 64),
    '武林广场两居室',
    '杭州',
    '武林小区',
    4800,
    '整租',
    '2室1厅',
    2,
    68.0,
    120.156000,
    30.275000,
    'https://example.com/house/2'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '2024-11',
    repeat('3', 64),
    '远郊一居室',
    '杭州',
    '远郊小区',
    2600,
    '合租',
    '1室0厅',
    1,
    30.0,
    120.250000,
    30.350000,
    null
  );

select is(
  (select count(*) from public.search_historical_houses(p_limit := 10)),
  0::bigint,
  'inactive release is not searchable'
);

select lives_ok(
  $$select public.activate_housing_dataset('10000000-0000-0000-0000-000000000001')$$,
  'complete release activates'
);
select is(
  (select status from public.housing_dataset_releases where id = '10000000-0000-0000-0000-000000000001'),
  'active',
  'release status becomes active'
);
select is(
  (select imported_count from public.housing_dataset_releases where id = '10000000-0000-0000-0000-000000000001'),
  3,
  'activation records the actual row count'
);
select is(
  (
    select count(*)
    from public.search_historical_houses(
      p_max_price := 3500,
      p_bedrooms := 1,
      p_limit := 10
    )
  ),
  2::bigint,
  'price and bedroom filters are applied'
);
select is(
  (
    select count(*)
    from public.search_historical_houses(
      p_rent_type := '整租',
      p_limit := 10
    )
  ),
  2::bigint,
  'rent type filter is applied'
);
select is(
  (
    select count(*)
    from public.search_historical_houses(
      p_center_longitude := 120.1551,
      p_center_latitude := 30.2741,
      p_radius_m := 1000,
      p_sort := 'distance',
      p_limit := 10
    )
  ),
  2::bigint,
  'radius filter excludes the distant row'
);
select is(
  (
    select id
    from public.search_historical_houses(
      p_center_longitude := 120.1551,
      p_center_latitude := 30.2741,
      p_radius_m := 1000,
      p_sort := 'distance',
      p_limit := 10
    )
    limit 1
  ),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'distance sort returns the center row first'
);
select is(
  (
    select total_count
    from public.search_historical_houses(p_max_price := 3500, p_limit := 1)
    limit 1
  ),
  2::bigint,
  'total count is calculated before pagination'
);
select is(
  (select count(*) from public.search_historical_houses(p_limit := 1)),
  1::bigint,
  'result limit is applied'
);
select throws_ok(
  $$select * from public.search_historical_houses(p_min_price := 5000, p_max_price := 3000)$$,
  '22023',
  'price range is invalid',
  'invalid price range is rejected'
);
select throws_ok(
  $$select * from public.search_historical_houses(p_radius_m := 1000)$$,
  '22023',
  'p_radius_m requires center coordinates',
  'radius without center is rejected'
);
select throws_ok(
  $$insert into public.historical_houses (
      id, release_id, dataset_period, source_key_hash, city, price_monthly, longitude, latitude
    ) values (
      '20000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000001',
      '2024-11',
      repeat('4', 64),
      '杭州',
      0,
      120.1,
      30.2
    )$$,
  '23514',
  null,
  'non-positive rent is rejected'
);
select ok(
  (
    select distance_m < 1
    from public.search_historical_houses(
      p_center_longitude := 120.1551,
      p_center_latitude := 30.2741,
      p_radius_m := 1000,
      p_sort := 'distance',
      p_limit := 1
    )
  ),
  'PostGIS distance for identical coordinates is below one meter'
);

select * from finish();
rollback;
