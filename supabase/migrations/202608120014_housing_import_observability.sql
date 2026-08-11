begin;

create or replace function public.get_housing_import_status(p_release_id uuid)
returns table (
  release_id uuid,
  status text,
  expected_count integer,
  imported_count integer,
  actual_count integer,
  content_checksum text,
  table_bytes bigint,
  index_bytes bigint,
  database_bytes bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.id as release_id,
    r.status,
    r.expected_count,
    r.imported_count,
    (
      select count(*)::integer
      from public.historical_houses h
      where h.release_id = r.id
    ) as actual_count,
    r.content_checksum,
    (
      pg_total_relation_size('public.historical_houses'::regclass)
      - pg_indexes_size('public.historical_houses'::regclass)
    )::bigint as table_bytes,
    pg_indexes_size('public.historical_houses'::regclass)::bigint as index_bytes,
    pg_database_size(current_database())::bigint as database_bytes
  from public.housing_dataset_releases r
  where r.id = p_release_id;
$$;

revoke execute on function public.get_housing_import_status(uuid)
from public, anon, authenticated;

grant execute on function public.get_housing_import_status(uuid)
to service_role;

commit;
