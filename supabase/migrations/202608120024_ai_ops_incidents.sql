begin;

create table public.ai_ops_incidents (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null
    check (alert_key in (
      'tool_failure_rate',
      'rag_no_result_rate',
      'knowledge_index_backlog',
      'rag_eval_failure_rate'
    )),
  severity text not null
    check (severity in ('warning', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  title text not null check (char_length(title) between 1 and 80),
  metric_value numeric not null check (metric_value >= 0),
  threshold_value numeric not null check (threshold_value >= 0),
  sample_count bigint not null check (sample_count >= 0),
  detail text not null check (char_length(detail) between 1 and 240),
  opened_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  acknowledged_at timestamptz,
  acknowledged_by text check (
    acknowledged_by is null
    or acknowledged_by ~ '^[a-z][a-z0-9_-]{2,79}$'
  ),
  resolved_at timestamptz,
  resolution_note text check (
    resolution_note is null
    or char_length(resolution_note) between 1 and 500
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (last_seen_at >= opened_at),
  check (
    (status = 'open' and acknowledged_at is null and resolved_at is null)
    or (status = 'acknowledged' and acknowledged_at is not null and resolved_at is null)
    or (status = 'resolved' and resolved_at is not null)
  )
);

create unique index ai_ops_incidents_one_active_signal_idx
  on public.ai_ops_incidents (alert_key)
  where status in ('open', 'acknowledged');
create index ai_ops_incidents_status_updated_idx
  on public.ai_ops_incidents (status, updated_at desc);

create table public.ai_ops_incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.ai_ops_incidents(id) on delete cascade,
  event_type text not null
    check (event_type in ('opened', 'acknowledged', 'resolved', 'recovered')),
  status_before text
    check (status_before is null or status_before in ('open', 'acknowledged', 'resolved')),
  status_after text not null
    check (status_after in ('open', 'acknowledged', 'resolved')),
  actor_label text not null
    check (actor_label ~ '^[a-z][a-z0-9_-]{2,79}$'),
  note text check (note is null or char_length(note) between 1 and 500),
  created_at timestamptz not null default timezone('utc', now())
);

create index ai_ops_incident_events_incident_created_idx
  on public.ai_ops_incident_events (incident_id, created_at desc);

alter table public.ai_ops_incidents enable row level security;
alter table public.ai_ops_incident_events enable row level security;

create or replace function public.sync_ai_ops_incidents(
  p_window_hours integer default 24
)
returns table (
  opened_count integer,
  refreshed_count integer,
  recovered_count integer,
  active_count integer,
  measured_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_signal record;
  v_incident record;
  v_incident_id uuid;
  v_now timestamptz := timezone('utc', now());
  v_opened integer := 0;
  v_refreshed integer := 0;
  v_recovered integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('xiaozhi:ai_ops_incident_sync')
  );
  for v_signal in
    select * from public.get_ai_ops_alerts(p_window_hours)
  loop
    if v_signal.state = 'alert' then
      select incidents.id
      into v_incident_id
      from public.ai_ops_incidents incidents
      where incidents.alert_key = v_signal.alert_key
        and incidents.status in ('open', 'acknowledged')
      for update;

      if v_incident_id is null then
        insert into public.ai_ops_incidents (
          alert_key,
          severity,
          title,
          metric_value,
          threshold_value,
          sample_count,
          detail,
          opened_at,
          last_seen_at,
          created_at,
          updated_at
        ) values (
          v_signal.alert_key,
          v_signal.severity,
          v_signal.title,
          v_signal.metric_value,
          v_signal.threshold_value,
          v_signal.sample_count,
          v_signal.detail,
          v_signal.measured_at,
          v_signal.measured_at,
          v_now,
          v_now
        )
        returning id into v_incident_id;

        insert into public.ai_ops_incident_events (
          incident_id,
          event_type,
          status_before,
          status_after,
          actor_label,
          note
        ) values (
          v_incident_id,
          'opened',
          null,
          'open',
          'system_monitor',
          '监控信号超过阈值，自动创建事故'
        );
        v_opened := v_opened + 1;
      else
        update public.ai_ops_incidents incidents
        set severity = v_signal.severity,
            title = v_signal.title,
            metric_value = v_signal.metric_value,
            threshold_value = v_signal.threshold_value,
            sample_count = v_signal.sample_count,
            detail = v_signal.detail,
            last_seen_at = v_signal.measured_at,
            updated_at = v_now
        where incidents.id = v_incident_id;
        v_refreshed := v_refreshed + 1;
      end if;
    else
      for v_incident in
        select incidents.id, incidents.status
        from public.ai_ops_incidents incidents
        where incidents.alert_key = v_signal.alert_key
          and incidents.status in ('open', 'acknowledged')
        for update
      loop
        update public.ai_ops_incidents incidents
        set status = 'resolved',
            last_seen_at = v_signal.measured_at,
            resolved_at = v_signal.measured_at,
            resolution_note = '监控信号已恢复到阈值内或样本不足',
            updated_at = v_now
        where incidents.id = v_incident.id;

        insert into public.ai_ops_incident_events (
          incident_id,
          event_type,
          status_before,
          status_after,
          actor_label,
          note
        ) values (
          v_incident.id,
          'recovered',
          v_incident.status,
          'resolved',
          'system_monitor',
          '监控信号已恢复到阈值内或样本不足'
        );
        v_recovered := v_recovered + 1;
      end loop;
    end if;
    v_incident_id := null;
  end loop;

  return query
  select
    v_opened,
    v_refreshed,
    v_recovered,
    count(*)::integer,
    v_now
  from public.ai_ops_incidents incidents
  where incidents.status in ('open', 'acknowledged');
end;
$$;

create or replace function public.search_ai_ops_incidents(
  p_limit integer default 20
)
returns table (
  id uuid,
  alert_key text,
  severity text,
  status text,
  title text,
  metric_value numeric,
  threshold_value numeric,
  sample_count bigint,
  detail text,
  opened_at timestamptz,
  last_seen_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by text,
  resolved_at timestamptz,
  resolution_note text,
  event_count bigint,
  updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select
    incidents.id,
    incidents.alert_key,
    incidents.severity,
    incidents.status,
    incidents.title,
    incidents.metric_value,
    incidents.threshold_value,
    incidents.sample_count,
    incidents.detail,
    incidents.opened_at,
    incidents.last_seen_at,
    incidents.acknowledged_at,
    incidents.acknowledged_by,
    incidents.resolved_at,
    incidents.resolution_note,
    (
      select count(*)
      from public.ai_ops_incident_events events
      where events.incident_id = incidents.id
    ),
    incidents.updated_at
  from public.ai_ops_incidents incidents
  order by
    case incidents.status
      when 'open' then 0
      when 'acknowledged' then 1
      else 2
    end,
    incidents.updated_at desc,
    incidents.id desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

create or replace function public.transition_ai_ops_incident(
  p_incident_id uuid,
  p_action text,
  p_actor_label text,
  p_note text default null
)
returns setof public.ai_ops_incidents
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_incident public.ai_ops_incidents%rowtype;
  v_note text := nullif(trim(p_note), '');
  v_now timestamptz := timezone('utc', now());
begin
  if p_action not in ('acknowledge', 'resolve') then
    raise exception using errcode = '22023', message = 'Invalid incident action';
  end if;
  if p_actor_label is null
    or p_actor_label !~ '^[a-z][a-z0-9_-]{2,79}$' then
    raise exception using errcode = '22023', message = 'Invalid incident actor';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception using errcode = '22023', message = 'Invalid incident note';
  end if;
  if p_action = 'resolve' and v_note is null then
    raise exception using errcode = '22023', message = 'Resolution note is required';
  end if;

  select * into v_incident
  from public.ai_ops_incidents incidents
  where incidents.id = p_incident_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Incident not found';
  end if;

  if p_action = 'acknowledge' then
    if v_incident.status = 'resolved' then
      raise exception using errcode = '22023', message = 'Resolved incident cannot be acknowledged';
    end if;
    if v_incident.status = 'open' then
      update public.ai_ops_incidents incidents
      set status = 'acknowledged',
          acknowledged_at = v_now,
          acknowledged_by = p_actor_label,
          updated_at = v_now
      where incidents.id = p_incident_id;
      insert into public.ai_ops_incident_events (
        incident_id,
        event_type,
        status_before,
        status_after,
        actor_label,
        note
      ) values (
        p_incident_id,
        'acknowledged',
        'open',
        'acknowledged',
        p_actor_label,
        v_note
      );
    end if;
  else
    if v_incident.status = 'open' then
      raise exception using
        errcode = '22023',
        message = 'Incident must be acknowledged before resolution';
    end if;
    if v_incident.status <> 'resolved' then
      update public.ai_ops_incidents incidents
      set status = 'resolved',
          resolved_at = v_now,
          resolution_note = v_note,
          updated_at = v_now
      where incidents.id = p_incident_id;
      insert into public.ai_ops_incident_events (
        incident_id,
        event_type,
        status_before,
        status_after,
        actor_label,
        note
      ) values (
        p_incident_id,
        'resolved',
        v_incident.status,
        'resolved',
        p_actor_label,
        v_note
      );
    end if;
  end if;

  return query
  select * from public.ai_ops_incidents incidents
  where incidents.id = p_incident_id;
end;
$$;

revoke all on table public.ai_ops_incidents, public.ai_ops_incident_events
from public, anon, authenticated, service_role;
grant select, insert, update on table public.ai_ops_incidents
to service_role;
grant select, insert on table public.ai_ops_incident_events
to service_role;

revoke all on function public.sync_ai_ops_incidents(integer)
from public, anon, authenticated;
grant execute on function public.sync_ai_ops_incidents(integer)
to service_role;

revoke all on function public.search_ai_ops_incidents(integer)
from public, anon, authenticated;
grant execute on function public.search_ai_ops_incidents(integer)
to service_role;

revoke all on function public.transition_ai_ops_incident(uuid, text, text, text)
from public, anon, authenticated;
grant execute on function public.transition_ai_ops_incident(uuid, text, text, text)
to service_role;

commit;
