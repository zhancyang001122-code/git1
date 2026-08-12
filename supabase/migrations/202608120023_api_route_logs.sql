begin;

create table public.api_route_logs (
  id uuid primary key default gen_random_uuid(),
  route_key text not null
    check (route_key ~ '^/api/[a-z0-9_/\[\]-]{1,180}$'),
  method text not null
    check (method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  status_code integer not null
    check (status_code between 100 and 599),
  duration_ms integer not null
    check (duration_ms between 0 and 300000),
  request_id uuid not null,
  error_code text
    check (error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{1,119}$'),
  created_at timestamptz not null default timezone('utc', now())
);

create index api_route_logs_created_at_idx
  on public.api_route_logs (created_at desc);
create index api_route_logs_route_status_idx
  on public.api_route_logs (route_key, status_code, created_at desc);

alter table public.api_route_logs enable row level security;

create or replace function public.search_api_route_logs(
  p_limit integer default 20,
  p_method text default null,
  p_status_class integer default null
)
returns table (
  id uuid,
  route_key text,
  method text,
  status_code integer,
  duration_ms integer,
  request_id uuid,
  error_code text,
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select
    logs.id,
    logs.route_key,
    logs.method,
    logs.status_code,
    logs.duration_ms,
    logs.request_id,
    logs.error_code,
    logs.created_at
  from public.api_route_logs logs
  where (
      nullif(trim(p_method), '') is null
      or logs.method = upper(trim(p_method))
    )
    and (
      p_status_class is null
      or logs.status_code between p_status_class * 100
        and p_status_class * 100 + 99
    )
  order by logs.created_at desc, logs.id desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke all on table public.api_route_logs
from public, anon, authenticated;
grant select, insert on table public.api_route_logs
to service_role;

revoke all on function public.search_api_route_logs(integer, text, integer)
from public, anon, authenticated;
grant execute on function public.search_api_route_logs(integer, text, integer)
to service_role;

commit;
