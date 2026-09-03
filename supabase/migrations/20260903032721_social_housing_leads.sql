begin;

create table public.social_housing_ingest_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  platform text not null check (platform in ('xiaohongshu', 'douyin')),
  keywords text[] not null check (cardinality(keywords) between 1 and 20),
  crawler_name text not null check (char_length(crawler_name) between 1 and 80),
  crawler_revision text not null check (crawler_revision ~ '^[0-9a-f]{40}$'),
  raw_count integer not null check (raw_count >= 0),
  processed_count integer not null default 0 check (
    processed_count >= 0 and processed_count <= raw_count
  ),
  approved_count integer not null default 0 check (
    approved_count >= 0 and approved_count <= processed_count
  ),
  content_checksum text not null check (content_checksum ~ '^[0-9a-f]{64}$'),
  status text not null default 'collected' check (
    status in ('collected', 'processing', 'processed', 'failed')
  ),
  failure_reason text check (
    failure_reason is null or char_length(failure_reason) <= 500
  ),
  collected_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (platform, content_checksum)
);

create table public.social_housing_leads (
  id uuid primary key default extensions.gen_random_uuid(),
  dedupe_key text not null unique check (dedupe_key ~ '^[0-9a-f]{64}$'),
  title text not null check (char_length(title) between 1 and 160),
  summary text not null check (char_length(summary) between 1 and 500),
  city text not null check (char_length(city) between 1 and 40),
  district text check (district is null or char_length(district) <= 80),
  community text check (community is null or char_length(community) <= 200),
  address text check (address is null or char_length(address) <= 300),
  price_min_monthly integer check (
    price_min_monthly is null or price_min_monthly between 1 and 1000000
  ),
  price_max_monthly integer check (
    price_max_monthly is null or price_max_monthly between 1 and 1000000
  ),
  rent_type text check (rent_type is null or char_length(rent_type) <= 40),
  layout text check (layout is null or char_length(layout) <= 80),
  bedrooms smallint check (bedrooms is null or bedrooms between 0 and 20),
  area_sqm numeric(7, 2) check (area_sqm is null or area_sqm > 0),
  longitude numeric(10, 6) check (longitude is null or longitude between -180 and 180),
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  amap_longitude numeric(10, 6) check (
    amap_longitude is null or amap_longitude between -180 and 180
  ),
  amap_latitude numeric(9, 6) check (
    amap_latitude is null or amap_latitude between -90 and 90
  ),
  location extensions.geography(point, 4326)
    generated always as (
      case
        when longitude is null or latitude is null then null
        else extensions.st_setsrid(
          extensions.st_makepoint(longitude::double precision, latitude::double precision),
          4326
        )::extensions.geography
      end
    ) stored,
  first_published_at timestamptz not null,
  last_seen_at timestamptz not null,
  review_status text not null default 'pending_review' check (
    review_status in ('pending_review', 'approved', 'rejected', 'stale', 'removed')
  ),
  availability_status text not null default 'unknown' check (
    availability_status in ('not_obviously_closed', 'closed', 'unknown')
  ),
  extraction_confidence numeric(4, 3) not null check (
    extraction_confidence between 0 and 1
  ),
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((longitude is null) = (latitude is null)),
  check ((amap_longitude is null) = (amap_latitude is null)),
  check (
    price_max_monthly is null
    or (price_min_monthly is not null and price_max_monthly >= price_min_monthly)
  ),
  check (first_published_at <= last_seen_at),
  check (
    review_status <> 'approved'
    or (
      reviewed_at is not null
      and availability_status = 'not_obviously_closed'
      and price_min_monthly is not null
      and longitude is not null
      and latitude is not null
      and amap_longitude is not null
      and amap_latitude is not null
    )
  )
);

create table public.social_housing_lead_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  lead_id uuid not null references public.social_housing_leads(id) on delete cascade,
  batch_id uuid not null references public.social_housing_ingest_batches(id) on delete restrict,
  platform text not null check (platform in ('xiaohongshu', 'douyin')),
  platform_post_id text not null check (char_length(platform_post_id) between 1 and 100),
  canonical_url text not null check (
    char_length(canonical_url) <= 2048
    and (
      (
        platform = 'xiaohongshu'
        and canonical_url ~ '^https://www\.xiaohongshu\.com/explore/[0-9a-f]{24}$'
      )
      or (
        platform = 'douyin'
        and canonical_url ~ '^https://www\.douyin\.com/video/[0-9]{15,25}$'
      )
    )
  ),
  source_keyword text not null check (char_length(source_keyword) between 1 and 120),
  source_published_at timestamptz not null,
  collected_at timestamptz not null,
  last_checked_at timestamptz not null,
  source_status text not null default 'unknown' check (
    source_status in ('not_obviously_closed', 'closed', 'unknown')
  ),
  raw_payload_hash text not null check (raw_payload_hash ~ '^[0-9a-f]{64}$'),
  extractor_version text not null check (char_length(extractor_version) between 1 and 80),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (platform, platform_post_id),
  unique (platform, raw_payload_hash)
);

create index social_housing_leads_location_idx
  on public.social_housing_leads using gist (location)
  where review_status = 'approved';

create index social_housing_leads_list_idx
  on public.social_housing_leads (
    city,
    review_status,
    availability_status,
    last_seen_at desc,
    price_min_monthly,
    id
  );

create index social_housing_leads_bedrooms_idx
  on public.social_housing_leads (city, bedrooms, rent_type, id)
  where review_status = 'approved';

create index social_housing_sources_lead_idx
  on public.social_housing_lead_sources (lead_id, source_published_at desc);

create trigger social_housing_batches_set_updated_at
before update on public.social_housing_ingest_batches
for each row execute function public.set_updated_at();

create trigger social_housing_leads_set_updated_at
before update on public.social_housing_leads
for each row execute function public.set_updated_at();

create trigger social_housing_sources_set_updated_at
before update on public.social_housing_lead_sources
for each row execute function public.set_updated_at();

alter table public.social_housing_ingest_batches enable row level security;
alter table public.social_housing_leads enable row level security;
alter table public.social_housing_lead_sources enable row level security;

revoke all on table
  public.social_housing_ingest_batches,
  public.social_housing_leads,
  public.social_housing_lead_sources
from public, anon, authenticated;

grant all privileges on table
  public.social_housing_ingest_batches,
  public.social_housing_leads,
  public.social_housing_lead_sources
to service_role;

create or replace function public.search_social_housing_leads(
  p_city text default '杭州',
  p_min_price integer default null,
  p_max_price integer default null,
  p_rent_type text default null,
  p_bedrooms integer default null,
  p_center_longitude double precision default null,
  p_center_latitude double precision default null,
  p_radius_m integer default null,
  p_sort text default 'published_desc',
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
  id uuid,
  title text,
  summary text,
  city text,
  district text,
  community text,
  address text,
  price_min_monthly integer,
  price_max_monthly integer,
  rent_type text,
  layout text,
  bedrooms smallint,
  area_sqm numeric,
  longitude numeric,
  latitude numeric,
  coordinate_system text,
  published_at timestamptz,
  last_seen_at timestamptz,
  source_platforms text[],
  source_count bigint,
  verification_label text,
  distance_m double precision,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_center extensions.geography(point, 4326);
  v_limit integer;
begin
  if p_city is null or char_length(trim(p_city)) = 0 or char_length(p_city) > 40 then
    raise exception using errcode = '22023', message = 'p_city is invalid';
  end if;
  if p_min_price is not null and p_min_price < 0 then
    raise exception using errcode = '22023', message = 'p_min_price is invalid';
  end if;
  if p_max_price is not null and p_max_price < 0 then
    raise exception using errcode = '22023', message = 'p_max_price is invalid';
  end if;
  if p_min_price is not null and p_max_price is not null and p_min_price > p_max_price then
    raise exception using errcode = '22023', message = 'price range is invalid';
  end if;
  if p_bedrooms is not null and p_bedrooms not between 0 and 20 then
    raise exception using errcode = '22023', message = 'p_bedrooms is invalid';
  end if;
  if (p_center_longitude is null) <> (p_center_latitude is null) then
    raise exception using errcode = '22023', message = 'center coordinates must be provided together';
  end if;
  if p_center_longitude is not null and p_center_longitude not between -180 and 180 then
    raise exception using errcode = '22023', message = 'p_center_longitude is invalid';
  end if;
  if p_center_latitude is not null and p_center_latitude not between -90 and 90 then
    raise exception using errcode = '22023', message = 'p_center_latitude is invalid';
  end if;
  if p_radius_m is not null and not (p_radius_m between 100 and 5000) then
    raise exception using errcode = '22023', message = 'p_radius_m is invalid';
  end if;
  if p_center_longitude is null and p_radius_m is not null then
    raise exception using errcode = '22023', message = 'p_radius_m requires center coordinates';
  end if;
  if p_sort not in ('distance', 'price_asc', 'price_desc', 'published_desc') then
    raise exception using errcode = '22023', message = 'p_sort is invalid';
  end if;
  if p_sort = 'distance' and p_center_longitude is null then
    raise exception using errcode = '22023', message = 'distance sort requires center coordinates';
  end if;
  if p_offset is null or p_offset < 0 or p_offset > 100000 then
    raise exception using errcode = '22023', message = 'p_offset is invalid';
  end if;
  if p_limit is null then
    raise exception using errcode = '22023', message = 'p_limit is invalid';
  end if;

  v_limit := greatest(1, least(p_limit, 24));
  if p_center_longitude is not null then
    v_center := extensions.st_setsrid(
      extensions.st_makepoint(p_center_longitude, p_center_latitude),
      4326
    )::extensions.geography;
  end if;

  return query
  with candidates as (
    select
      l.id,
      l.title,
      l.summary,
      l.city,
      l.district,
      l.community,
      l.address,
      l.price_min_monthly,
      l.price_max_monthly,
      l.rent_type,
      l.layout,
      l.bedrooms,
      l.area_sqm,
      l.longitude,
      l.latitude,
      l.first_published_at as published_at,
      l.last_seen_at,
      source_summary.source_platforms,
      source_summary.source_count,
      case
        when v_center is null then null
        else extensions.st_distance(l.location, v_center)
      end as distance_m
    from public.social_housing_leads l
    cross join lateral (
      select
        array_agg(distinct s.platform order by s.platform)::text[] as source_platforms,
        count(*)::bigint as source_count
      from public.social_housing_lead_sources s
      where s.lead_id = l.id
    ) source_summary
    where l.review_status = 'approved'
      and l.availability_status = 'not_obviously_closed'
      and l.last_seen_at >= timezone('utc', now()) - interval '120 days'
      and l.city = trim(p_city)
      and (
        p_min_price is null
        or coalesce(l.price_max_monthly, l.price_min_monthly) >= p_min_price
      )
      and (p_max_price is null or l.price_min_monthly <= p_max_price)
      and (p_rent_type is null or l.rent_type = p_rent_type)
      and (p_bedrooms is null or l.bedrooms = p_bedrooms)
      and (
        v_center is null
        or p_radius_m is null
        or extensions.st_dwithin(l.location, v_center, p_radius_m)
      )
      and source_summary.source_count > 0
  )
  select
    c.id,
    c.title,
    c.summary,
    c.city,
    c.district,
    c.community,
    c.address,
    c.price_min_monthly,
    c.price_max_monthly,
    c.rent_type,
    c.layout,
    c.bedrooms,
    c.area_sqm,
    c.longitude,
    c.latitude,
    'wgs84'::text as coordinate_system,
    c.published_at,
    c.last_seen_at,
    c.source_platforms,
    c.source_count,
    '房态未经核验'::text as verification_label,
    c.distance_m,
    count(*) over() as total_count
  from candidates c
  order by
    case when p_sort = 'distance' then c.distance_m end asc nulls last,
    case when p_sort = 'price_asc' then c.price_min_monthly end asc nulls last,
    case when p_sort = 'price_desc' then c.price_min_monthly end desc nulls last,
    case when p_sort = 'published_desc' then c.published_at end desc nulls last,
    c.id
  offset p_offset
  limit v_limit;
end;
$$;

create or replace function public.get_social_housing_lead_detail(p_id uuid)
returns table (
  id uuid,
  title text,
  summary text,
  city text,
  district text,
  community text,
  address text,
  price_min_monthly integer,
  price_max_monthly integer,
  rent_type text,
  layout text,
  bedrooms smallint,
  area_sqm numeric,
  longitude numeric,
  latitude numeric,
  coordinate_system text,
  published_at timestamptz,
  last_seen_at timestamptz,
  source_platforms text[],
  source_count bigint,
  verification_label text,
  distance_m double precision,
  total_count bigint,
  sources jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    l.id,
    l.title,
    l.summary,
    l.city,
    l.district,
    l.community,
    l.address,
    l.price_min_monthly,
    l.price_max_monthly,
    l.rent_type,
    l.layout,
    l.bedrooms,
    l.area_sqm,
    l.longitude,
    l.latitude,
    'wgs84'::text as coordinate_system,
    l.first_published_at as published_at,
    l.last_seen_at,
    array_agg(distinct s.platform order by s.platform)::text[] as source_platforms,
    count(s.id)::bigint as source_count,
    '房态未经核验'::text as verification_label,
    null::double precision as distance_m,
    null::bigint as total_count,
    jsonb_agg(
      jsonb_build_object(
        'platform', s.platform,
        'canonical_url', s.canonical_url,
        'source_published_at', s.source_published_at,
        'last_checked_at', s.last_checked_at,
        'source_status', s.source_status
      )
      order by s.source_published_at desc, s.id
    ) as sources
  from public.social_housing_leads l
  join public.social_housing_lead_sources s on s.lead_id = l.id
  where l.id = p_id
    and l.review_status = 'approved'
    and l.availability_status = 'not_obviously_closed'
    and l.last_seen_at >= timezone('utc', now()) - interval '120 days'
  group by l.id;
$$;

revoke execute on function public.search_social_housing_leads(
  text, integer, integer, text, integer, double precision, double precision,
  integer, text, integer, integer
) from public, anon, authenticated;

revoke execute on function public.get_social_housing_lead_detail(uuid)
from public, anon, authenticated;

grant execute on function public.search_social_housing_leads(
  text, integer, integer, text, integer, double precision, double precision,
  integer, text, integer, integer
) to service_role;

grant execute on function public.get_social_housing_lead_detail(uuid)
to service_role;

commit;
