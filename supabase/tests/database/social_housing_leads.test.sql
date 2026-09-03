begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

select has_table('public', 'social_housing_ingest_batches', 'ingest batch table exists');
select has_table('public', 'social_housing_leads', 'normalized lead table exists');
select has_table('public', 'social_housing_lead_sources', 'lead source table exists');
select has_column('public', 'social_housing_leads', 'location', 'lead has indexed WGS84 location');
select has_column('public', 'social_housing_lead_sources', 'canonical_url', 'source keeps canonical public URL');
select hasnt_column('public', 'social_housing_leads', 'nickname', 'public lead excludes author nickname');
select hasnt_column('public', 'social_housing_leads', 'contact_phone', 'public lead excludes contact details');
select hasnt_column('public', 'social_housing_lead_sources', 'xsec_token', 'source excludes temporary access tokens');
select hasnt_column('public', 'social_housing_lead_sources', 'raw_payload', 'source excludes raw post payload');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.social_housing_ingest_batches'::regclass),
  'batch table has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.social_housing_leads'::regclass),
  'lead table has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.social_housing_lead_sources'::regclass),
  'source table has RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.social_housing_leads', 'select'),
  'anon cannot read leads directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.social_housing_leads', 'select'),
  'authenticated cannot read leads directly'
);
select ok(
  has_table_privilege('service_role', 'public.social_housing_leads', 'select'),
  'service role can read leads'
);

-- Keep the contract test deterministic even when a developer has imported
-- local pilot data. The surrounding transaction rolls this cleanup back.
truncate table public.social_housing_lead_sources,
  public.social_housing_leads,
  public.social_housing_ingest_batches;

insert into public.social_housing_ingest_batches (
  id,
  platform,
  keywords,
  crawler_name,
  crawler_revision,
  raw_count,
  processed_count,
  approved_count,
  content_checksum,
  status,
  collected_at
) values (
  '31000000-0000-4000-8000-000000000001',
  'xiaohongshu',
  array['杭州转租'],
  'MediaCrawler',
  'd6f7c5bb906b6dac40ddf343ef9e26438a3de092',
  2,
  2,
  1,
  repeat('a', 64),
  'processed',
  '2026-09-03T02:19:00Z'
);

insert into public.social_housing_leads (
  id,
  dedupe_key,
  title,
  summary,
  city,
  district,
  community,
  price_min_monthly,
  price_max_monthly,
  rent_type,
  layout,
  bedrooms,
  longitude,
  latitude,
  amap_longitude,
  amap_latitude,
  first_published_at,
  last_seen_at,
  review_status,
  availability_status,
  extraction_confidence,
  reviewed_at
) values
  (
    '32000000-0000-4000-8000-000000000001',
    repeat('1', 64),
    '萧山区一居室个人转租',
    '近地铁的一居室转租线索。',
    '杭州',
    '萧山区',
    '建设三路附近',
    950,
    1200,
    '整租',
    '1室1厅',
    1,
    120.246800,
    30.186200,
    120.251200,
    30.183800,
    '2026-06-26T08:00:00Z',
    '2026-09-03T02:19:00Z',
    'approved',
    'not_obviously_closed',
    0.89,
    '2026-09-03T03:00:00Z'
  ),
  (
    '32000000-0000-4000-8000-000000000002',
    repeat('2', 64),
    '等待审核的线索',
    '该线索不能出现在公开查询。',
    '杭州',
    '拱墅区',
    '武林广场附近',
    2800,
    null,
    '整租',
    '1室1厅',
    1,
    120.150000,
    30.270000,
    120.155100,
    30.274100,
    '2026-08-30T08:00:00Z',
    '2026-09-03T02:19:00Z',
    'pending_review',
    'unknown',
    0.72,
    null
  );

insert into public.social_housing_lead_sources (
  id,
  lead_id,
  batch_id,
  platform,
  platform_post_id,
  canonical_url,
  source_keyword,
  source_published_at,
  collected_at,
  last_checked_at,
  source_status,
  raw_payload_hash,
  extractor_version
) values (
  '33000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  'xiaohongshu',
  '69bbc8f4000000002800bb6b',
  'https://www.xiaohongshu.com/explore/69bbc8f4000000002800bb6b',
  '杭州转租',
  '2026-06-26T08:00:00Z',
  '2026-09-03T02:19:00Z',
  '2026-09-03T02:19:00Z',
  'not_obviously_closed',
  repeat('b', 64),
  'qwen-structured-v1'
);

select is(
  (select count(*) from public.search_social_housing_leads(p_limit := 24)),
  1::bigint,
  'only approved leads are searchable'
);
select is(
  (
    select verification_label
    from public.search_social_housing_leads(p_limit := 24)
    limit 1
  ),
  '房态未经核验',
  'search result states the verification boundary'
);
select is(
  (
    select source_count
    from public.search_social_housing_leads(p_limit := 24)
    limit 1
  ),
  1::bigint,
  'search result counts retained sources'
);
select is(
  (
    select source_platforms
    from public.search_social_housing_leads(p_limit := 24)
    limit 1
  ),
  array['xiaohongshu']::text[],
  'search result lists source platforms'
);
select is(
  (
    select count(*)
    from public.search_social_housing_leads(
      p_max_price := 1000,
      p_bedrooms := 1,
      p_limit := 24
    )
  ),
  1::bigint,
  'price and bedroom filters are applied'
);
select is(
  (
    select id
    from public.search_social_housing_leads(
      p_center_longitude := 120.2468,
      p_center_latitude := 30.1862,
      p_sort := 'distance',
      p_limit := 1
    )
  ),
  '32000000-0000-4000-8000-000000000001'::uuid,
  'distance sort uses canonical WGS84 coordinates'
);
select ok(
  (
    select distance_m < 1
    from public.search_social_housing_leads(
      p_center_longitude := 120.2468,
      p_center_latitude := 30.1862,
      p_sort := 'distance',
      p_limit := 1
    )
  ),
  'identical WGS84 coordinates have sub-metre distance'
);
select is(
  (
    select jsonb_array_length(sources)
    from public.get_social_housing_lead_detail(
      '32000000-0000-4000-8000-000000000001'
    )
  ),
  1,
  'approved lead detail includes its source list'
);
select is(
  (
    select sources->0->>'canonical_url'
    from public.get_social_housing_lead_detail(
      '32000000-0000-4000-8000-000000000001'
    )
  ),
  'https://www.xiaohongshu.com/explore/69bbc8f4000000002800bb6b',
  'detail returns a token-free canonical source URL'
);
select is(
  (
    select count(*)
    from public.get_social_housing_lead_detail(
      '32000000-0000-4000-8000-000000000002'
    )
  ),
  0::bigint,
  'pending lead detail is not publicly queryable'
);
select throws_ok(
  $$insert into public.social_housing_lead_sources (
      lead_id, batch_id, platform, platform_post_id, canonical_url,
      source_keyword, source_published_at, collected_at, last_checked_at,
      raw_payload_hash, extractor_version
    ) values (
      '32000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000001',
      'xiaohongshu',
      '69bbc8f4000000002800bb6c',
      'https://www.xiaohongshu.com/explore/69bbc8f4000000002800bb6c?xsec_token=secret',
      '杭州转租', now(), now(), now(), repeat('c', 64), 'qwen-structured-v1'
    )$$,
  '23514',
  null,
  'temporary URL tokens are rejected'
);
select throws_ok(
  $$insert into public.social_housing_leads (
      dedupe_key, title, summary, city, price_min_monthly, first_published_at,
      last_seen_at, review_status, availability_status, extraction_confidence
    ) values (
      repeat('3', 64), '无坐标', '不能通过审核', '杭州', 1800, now(), now(),
      'approved', 'unknown', 0.8
    )$$,
  '23514',
  null,
  'approved leads require complete publishable fields'
);
select throws_ok(
  $$select * from public.search_social_housing_leads(
      p_min_price := 5000,
      p_max_price := 3000
    )$$,
  '22023',
  'price range is invalid',
  'invalid price range is rejected'
);
select ok(
  not has_function_privilege('anon', 'public.search_social_housing_leads(text,integer,integer,text,integer,double precision,double precision,integer,text,integer,integer)', 'execute'),
  'anon cannot execute lead search directly'
);
select ok(
  has_function_privilege('service_role', 'public.search_social_housing_leads(text,integer,integer,text,integer,double precision,double precision,integer,text,integer,integer)', 'execute'),
  'service role can execute lead search'
);
select ok(
  not has_function_privilege('anon', 'public.get_social_housing_lead_detail(uuid)', 'execute'),
  'anon cannot execute lead detail directly'
);
select ok(
  has_function_privilege('service_role', 'public.get_social_housing_lead_detail(uuid)', 'execute'),
  'service role can execute lead detail'
);

select * from finish();
rollback;
