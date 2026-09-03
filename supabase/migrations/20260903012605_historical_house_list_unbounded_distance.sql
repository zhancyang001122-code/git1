begin;

-- A null radius now means "do not radius-filter". This lets the public list
-- paginate the complete active release while retaining distance ordering.
-- Agent calls keep passing an explicit radius and therefore preserve their
-- existing nearby-search behavior.
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
    v_radius_m := p_radius_m;
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
      or v_radius_m is null
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

revoke execute on function public.search_historical_houses(
  text, integer, integer, text, integer, double precision, double precision,
  integer, text, integer, integer
) from public, anon, authenticated;

grant execute on function public.search_historical_houses(
  text, integer, integer, text, integer, double precision, double precision,
  integer, text, integer, integer
) to service_role;

commit;
