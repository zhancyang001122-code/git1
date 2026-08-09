begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.knowledge_status as enum ('draft', 'reviewing', 'published', 'archived', 'rejected');
create type public.embedding_status as enum ('pending', 'processing', 'ready', 'failed');
create type public.tool_run_status as enum ('queued', 'running', 'succeeded', 'failed', 'timed_out');
create type public.feedback_rating as enum ('up', 'down');
create type public.knowledge_candidate_status as enum ('pending', 'drafted', 'reviewing', 'approved', 'rejected', 'published');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

commit;
