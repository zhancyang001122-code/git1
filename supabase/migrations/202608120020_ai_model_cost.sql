begin;

create or replace function public.get_ai_model_usage(
  p_window_hours integer default 168
)
returns table (
  model_name text,
  input_tokens integer,
  output_tokens integer,
  requests bigint
)
language sql
security invoker
set search_path = ''
as $$
  with parameters as (
    select
      greatest(1, least(p_window_hours, 720)) as bounded_hours,
      timezone('utc', now()) as measured_at
  )
  select
    coalesce(nullif(trim(messages.model_name), ''), 'unknown') as model_name,
    messages.input_tokens,
    messages.output_tokens,
    count(*)::bigint as requests
  from public.conversation_messages messages, parameters
  where messages.role = 'assistant'
    and messages.created_at >= parameters.measured_at
      - make_interval(hours => parameters.bounded_hours)
  group by
    coalesce(nullif(trim(messages.model_name), ''), 'unknown'),
    messages.input_tokens,
    messages.output_tokens
  order by model_name, input_tokens nulls last, output_tokens nulls last;
$$;

revoke all on function public.get_ai_model_usage(integer)
from public, anon, authenticated;
grant execute on function public.get_ai_model_usage(integer)
to service_role;

commit;
