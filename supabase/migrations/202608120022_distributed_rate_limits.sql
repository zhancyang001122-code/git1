begin;

create table public.api_rate_limit_windows (
  scope text not null
    check (scope ~ '^[a-z][a-z0-9_]{1,63}$'),
  key_hash text not null
    check (key_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  expires_at timestamptz not null,
  request_count integer not null default 0
    check (request_count >= 0),
  primary key (scope, key_hash, window_start),
  check (expires_at > window_start)
);

create index api_rate_limit_windows_expiry_idx
  on public.api_rate_limit_windows (expires_at);

alter table public.api_rate_limit_windows enable row level security;

create or replace function public.check_api_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_limit integer;
  v_window_seconds integer;
  v_window_start timestamptz;
  v_expires_at timestamptz;
  v_request_count integer;
begin
  if p_scope is null or p_scope !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception using
      errcode = '22023',
      message = 'Invalid rate limit scope';
  end if;
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'Invalid rate limit key hash';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception using
      errcode = '22023',
      message = 'Invalid rate limit maximum';
  end if;
  if p_window_seconds is null
    or p_window_seconds < 1
    or p_window_seconds > 3600 then
    raise exception using
      errcode = '22023',
      message = 'Invalid rate limit window';
  end if;

  v_limit := p_limit;
  v_window_seconds := p_window_seconds;
  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / v_window_seconds)
      * v_window_seconds
  );
  v_expires_at := v_window_start
    + make_interval(secs => v_window_seconds);

  delete from public.api_rate_limit_windows windows
  where windows.expires_at < v_now;

  insert into public.api_rate_limit_windows as windows (
    scope,
    key_hash,
    window_start,
    expires_at,
    request_count
  ) values (
    p_scope,
    p_key_hash,
    v_window_start,
    v_expires_at,
    1
  )
  on conflict (scope, key_hash, window_start) do update
  set request_count = windows.request_count + 1,
      expires_at = excluded.expires_at
  returning request_count into v_request_count;

  return query
  select
    v_request_count <= v_limit,
    greatest(0, v_limit - v_request_count),
    greatest(
      1,
      ceil(extract(epoch from (v_expires_at - v_now)))::integer
    );
end;
$$;

revoke all on table public.api_rate_limit_windows
from anon, authenticated;
grant all privileges on table public.api_rate_limit_windows
to service_role;

revoke all on function public.check_api_rate_limit(text, text, integer, integer)
from public, anon, authenticated;
grant execute on function public.check_api_rate_limit(text, text, integer, integer)
to service_role;

commit;
