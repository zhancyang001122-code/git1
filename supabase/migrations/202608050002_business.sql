begin;

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  city text not null default '杭州',
  district text not null,
  address text not null,
  longitude numeric(10, 6) not null check (longitude between -180 and 180),
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  delivery_minutes integer check (delivery_minutes is null or delivery_minutes between 1 and 240),
  minimum_order numeric(10, 2) not null default 0 check (minimum_order >= 0),
  image_url text,
  active boolean not null default true,
  is_demo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.houses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default '杭州',
  district text not null,
  address text not null,
  price_monthly integer not null check (price_monthly > 0),
  room_type text not null,
  area_sqm numeric(7, 2) not null check (area_sqm > 0),
  pets_allowed boolean not null default false,
  available boolean not null default true,
  subway_distance_m integer check (subway_distance_m is null or subway_distance_m >= 0),
  longitude numeric(10, 6) not null check (longitude between -180 and 180),
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  description text not null default '',
  image_urls text[] not null default '{}',
  tags text[] not null default '{}',
  is_demo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  title text not null,
  merchant_name text not null,
  category text not null,
  original_price numeric(10, 2) not null check (original_price >= 0),
  sale_price numeric(10, 2) not null check (sale_price >= 0),
  refundable boolean not null default true,
  refund_policy_label text not null default '以详情规则为准',
  valid_until date not null,
  address text not null,
  longitude numeric(10, 6) not null check (longitude between -180 and 180),
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  description text not null default '',
  image_url text,
  tags text[] not null default '{}',
  sales_count integer not null default 0 check (sales_count >= 0),
  active boolean not null default true,
  is_demo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (sale_price <= original_price)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  category text not null,
  price numeric(10, 2) not null check (price >= 0),
  description text not null default '',
  image_url text,
  tags text[] not null default '{}',
  active boolean not null default true,
  is_demo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.product_inventory (
  product_id uuid primary key references public.products(id) on delete cascade,
  stock integer not null default 0 check (stock >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= stock),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  author_name text not null,
  author_avatar_url text,
  location_label text,
  cover_image_url text,
  tags text[] not null default '{}',
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  published boolean not null default true,
  is_demo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index houses_filter_idx on public.houses (city, district, available, price_monthly);
create index houses_pets_room_idx on public.houses (pets_allowed, room_type);
create index deals_filter_idx on public.deals (category, active, sale_price, valid_until);
create index products_filter_idx on public.products (store_id, category, active, price);
create index community_posts_feed_idx on public.community_posts (published, created_at desc);

create trigger stores_set_updated_at before update on public.stores for each row execute function public.set_updated_at();
create trigger houses_set_updated_at before update on public.houses for each row execute function public.set_updated_at();
create trigger deals_set_updated_at before update on public.deals for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger inventory_set_updated_at before update on public.product_inventory for each row execute function public.set_updated_at();
create trigger posts_set_updated_at before update on public.community_posts for each row execute function public.set_updated_at();

commit;
