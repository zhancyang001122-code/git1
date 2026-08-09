begin;

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '小智体验用户',
  avatar_url text,
  city text not null default '杭州',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  max_housing_budget integer check (max_housing_budget is null or max_housing_budget >= 0),
  pets text[] not null default '{}',
  preferred_areas text[] not null default '{}',
  dietary_restrictions text[] not null default '{}',
  transport_modes text[] not null default '{}',
  family_profile text[] not null default '{}',
  allow_long_term_memory boolean not null default false,
  consented_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((allow_long_term_memory = false) or (consented_at is not null))
);

create table public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  recipient_name text not null,
  phone_masked text,
  city text not null default '杭州',
  district text not null,
  address_line text not null,
  longitude numeric(10, 6),
  latitude numeric(9, 6),
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('house', 'deal', 'product', 'community_post')),
  target_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, target_type, target_id)
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, product_id)
);

create table public.demo_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_no text not null unique,
  order_type text not null check (order_type in ('deal', 'market', 'housing_booking')),
  status text not null check (status in ('created', 'paid_demo', 'fulfilled_demo', 'cancelled', 'refunded_demo')),
  total_amount numeric(10, 2) not null default 0 check (total_amount >= 0),
  is_demo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.demo_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.demo_orders(id) on delete cascade,
  item_type text not null check (item_type in ('deal', 'product', 'house_booking')),
  item_id uuid not null,
  title_snapshot text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('system', 'xiaozhi', 'interaction', 'order')),
  title text not null,
  body text not null,
  target_type text,
  target_id text,
  read_at timestamptz,
  is_demo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_id text,
  title text not null default '新对话',
  summary text not null default '',
  last_location_label text,
  last_longitude numeric(10, 6),
  last_latitude numeric(9, 6),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (user_id is not null or anonymous_id is not null)
);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content text not null default '',
  structured_payload jsonb,
  model_name text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default timezone('utc', now())
);

create index addresses_user_idx on public.user_addresses (user_id, is_default desc);
create unique index one_default_address_per_user_idx on public.user_addresses (user_id) where is_default = true;
create index orders_user_idx on public.demo_orders (user_id, created_at desc);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index sessions_user_idx on public.conversation_sessions (user_id, updated_at desc);
create index sessions_anonymous_idx on public.conversation_sessions (anonymous_id, updated_at desc);
create index messages_session_idx on public.conversation_messages (session_id, created_at);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), '小智体验用户'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger profiles_set_updated_at before update on public.user_profiles for each row execute function public.set_updated_at();
create trigger preferences_set_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();
create trigger addresses_set_updated_at before update on public.user_addresses for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.demo_orders for each row execute function public.set_updated_at();
create trigger cart_set_updated_at before update on public.cart_items for each row execute function public.set_updated_at();
create trigger sessions_set_updated_at before update on public.conversation_sessions for each row execute function public.set_updated_at();

commit;
