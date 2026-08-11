begin;

create extension if not exists postgis with schema extensions;

create table public.housing_dataset_releases (
  id uuid primary key default extensions.gen_random_uuid(),
  dataset_period text not null check (dataset_period ~ '^[0-9]{4}-[0-9]{2}$'),
  source_label text not null check (char_length(source_label) between 1 and 200),
  disclaimer text not null check (char_length(disclaimer) between 1 and 500),
  status text not null default 'importing' check (status in ('importing', 'active', 'failed', 'archived')),
  expected_count integer not null check (expected_count > 0),
  imported_count integer not null default 0 check (imported_count >= 0 and imported_count <= expected_count),
  content_checksum text not null check (content_checksum ~ '^[0-9a-f]{64}$'),
  failure_reason text check (failure_reason is null or char_length(failure_reason) <= 500),
  activated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (dataset_period),
  unique (id, dataset_period),
  check ((status = 'active' and activated_at is not null) or status <> 'active')
);

create table public.historical_houses (
  id uuid primary key,
  release_id uuid not null,
  dataset_period text not null,
  source_key_hash text not null check (source_key_hash ~ '^[0-9a-f]{64}$'),
  title text check (title is null or char_length(title) <= 300),
  city text not null check (char_length(city) between 1 and 40),
  district text check (district is null or char_length(district) <= 80),
  address text check (address is null or char_length(address) <= 300),
  community text check (community is null or char_length(community) <= 200),
  price_monthly integer not null check (price_monthly > 0 and price_monthly <= 1000000),
  rent_type text check (rent_type is null or char_length(rent_type) <= 40),
  layout text check (layout is null or char_length(layout) <= 80),
  bedrooms smallint check (bedrooms is null or bedrooms between 0 and 20),
  area_sqm numeric(7, 2) check (area_sqm is null or area_sqm > 0),
  floor text check (floor is null or char_length(floor) <= 100),
  orientation text check (orientation is null or char_length(orientation) <= 100),
  longitude numeric(10, 6) not null check (longitude between -180 and 180),
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  location extensions.geography(point, 4326)
    generated always as (
      extensions.st_setsrid(
        extensions.st_makepoint(longitude::double precision, latitude::double precision),
        4326
      )::extensions.geography
    ) stored not null,
  source_url text check (
    source_url is null
    or (char_length(source_url) <= 2048 and source_url ~* '^https?://')
  ),
  is_historical boolean not null default true check (is_historical = true),
  created_at timestamptz not null default timezone('utc', now()),
  constraint historical_houses_release_fk
    foreign key (release_id, dataset_period)
    references public.housing_dataset_releases (id, dataset_period)
    on delete cascade,
  unique (release_id, source_key_hash)
);

create unique index housing_dataset_one_active_idx
  on public.housing_dataset_releases ((status))
  where status = 'active';

create index historical_houses_location_idx
  on public.historical_houses using gist (location);

create index historical_houses_filter_idx
  on public.historical_houses (release_id, city, price_monthly, id);

create index historical_houses_bedrooms_rent_idx
  on public.historical_houses (release_id, bedrooms, rent_type, id);

create trigger housing_releases_set_updated_at
before update on public.housing_dataset_releases
for each row execute function public.set_updated_at();

alter table public.housing_dataset_releases enable row level security;
alter table public.historical_houses enable row level security;

revoke all on table
  public.housing_dataset_releases,
  public.historical_houses
from public;

revoke all on table
  public.housing_dataset_releases,
  public.historical_houses
from anon;

revoke all on table
  public.housing_dataset_releases,
  public.historical_houses
from authenticated;

grant all privileges on table
  public.housing_dataset_releases,
  public.historical_houses
to service_role;

create or replace function public.search_historical_houses(
  p_city text default '杭州',
  p_min_price integer default null,
  p_max_price integer default null,
  p_rent_type text default null,
  p_bedrooms integer default null,
  p_center_longitude double precision default null,
  p_center_latitude double precision default null,
  p_radius_m integer default null,
  p_sort text default 'price_asc',
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
  id uuid,
  title text,
  city text,
  district text,
  address text,
  community text,
  price_monthly integer,
  rent_type text,
  layout text,
  bedrooms smallint,
  area_sqm numeric,
  floor text,
  orientation text,
  longitude numeric,
  latitude numeric,
  source_url text,
  dataset_period text,
  source_label text,
  disclaimer text,
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
  v_radius_m integer;
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
  if p_sort not in ('distance', 'price_asc', 'price_desc', 'area_desc') then
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
    v_radius_m := coalesce(p_radius_m, 2000);
  end if;

  return query
  select
    h.id,
    h.title,
    h.city,
    h.district,
    h.address,
    h.community,
    h.price_monthly,
    h.rent_type,
    h.layout,
    h.bedrooms,
    h.area_sqm,
    h.floor,
    h.orientation,
    h.longitude,
    h.latitude,
    h.source_url,
    r.dataset_period,
    r.source_label,
    r.disclaimer,
    case
      when v_center is null then null
      else extensions.st_distance(h.location, v_center)
    end as distance_m,
    count(*) over() as total_count
  from public.historical_houses h
  join public.housing_dataset_releases r on r.id = h.release_id
  where r.status = 'active'
    and h.city = trim(p_city)
    and (p_min_price is null or h.price_monthly >= p_min_price)
    and (p_max_price is null or h.price_monthly <= p_max_price)
    and (p_rent_type is null or h.rent_type = p_rent_type)
    and (p_bedrooms is null or h.bedrooms = p_bedrooms)
    and (
      v_center is null
      or extensions.st_dwithin(h.location, v_center, v_radius_m)
    )
  order by
    case when p_sort = 'distance' then extensions.st_distance(h.location, v_center) end asc nulls last,
    case when p_sort = 'price_asc' then h.price_monthly end asc nulls last,
    case when p_sort = 'price_desc' then h.price_monthly end desc nulls last,
    case when p_sort = 'area_desc' then h.area_sqm end desc nulls last,
    h.id
  offset p_offset
  limit v_limit;
end;
$$;

create or replace function public.activate_housing_dataset(p_release_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_release public.housing_dataset_releases%rowtype;
  v_actual_count integer;
  v_period_mismatch_count integer;
begin
  select * into v_release
  from public.housing_dataset_releases
  where id = p_release_id
  for update;

  if v_release.id is null then
    raise exception using errcode = 'P0002', message = 'housing release was not found';
  end if;
  if v_release.status = 'active' then
    return;
  end if;
  if v_release.status <> 'importing' then
    raise exception using errcode = '55000', message = 'housing release is not activatable';
  end if;

  select count(*)::integer into v_actual_count
  from public.historical_houses
  where release_id = p_release_id;

  select count(*)::integer into v_period_mismatch_count
  from public.historical_houses
  where release_id = p_release_id
    and dataset_period <> v_release.dataset_period;

  if v_period_mismatch_count <> 0 then
    raise exception using errcode = '23514', message = 'housing release contains period mismatches';
  end if;
  if v_actual_count <> v_release.expected_count then
    raise exception using errcode = '23514', message = 'housing release row count does not match expected_count';
  end if;

  update public.housing_dataset_releases
  set status = 'archived'
  where status = 'active'
    and id <> p_release_id;

  update public.housing_dataset_releases
  set
    status = 'active',
    imported_count = v_actual_count,
    activated_at = timezone('utc', now()),
    failure_reason = null
  where id = p_release_id;
end;
$$;

revoke execute on function public.search_historical_houses(
  text, integer, integer, text, integer, double precision, double precision,
  integer, text, integer, integer
) from public, anon, authenticated;

revoke execute on function public.activate_housing_dataset(uuid)
from public, anon, authenticated;

grant execute on function public.search_historical_houses(
  text, integer, integer, text, integer, double precision, double precision,
  integer, text, integer, integer
) to service_role;

grant execute on function public.activate_housing_dataset(uuid)
to service_role;

commit;
