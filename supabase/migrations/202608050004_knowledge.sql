begin;

create table public.kb_categories (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('housing', 'group_buy', 'market', 'platform')),
  slug text not null,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  unique (domain, slug)
);

create table public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.kb_categories(id),
  slug text not null unique,
  title text not null,
  owner_name text not null,
  city text,
  status public.knowledge_status not null default 'draft',
  current_version_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.kb_article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.kb_articles(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  version_label text not null,
  content_markdown text not null,
  source_reference text not null,
  effective_from date,
  effective_until date,
  status public.knowledge_status not null default 'draft',
  change_summary text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (article_id, version_number),
  check (effective_until is null or effective_from is null or effective_until >= effective_from)
);

alter table public.kb_articles
  add constraint kb_articles_current_version_fk
  foreign key (current_version_id) references public.kb_article_versions(id) on delete set null;

create table public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.kb_articles(id) on delete cascade,
  version_id uuid not null references public.kb_article_versions(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  token_count integer check (token_count is null or token_count > 0),
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1024),
  embedding_status public.embedding_status not null default 'pending',
  embedding_model text,
  embedded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (version_id, chunk_index)
);

create index kb_articles_status_idx on public.kb_articles (status, category_id);
create index kb_versions_publish_idx on public.kb_article_versions (status, effective_from, effective_until);
create index kb_chunks_article_idx on public.kb_chunks (article_id, version_id);
create index kb_chunks_metadata_idx on public.kb_chunks using gin (metadata);
create index kb_chunks_content_trgm_idx on public.kb_chunks using gin (content extensions.gin_trgm_ops);
create index kb_chunks_embedding_hnsw_idx on public.kb_chunks using hnsw (embedding extensions.vector_cosine_ops) where embedding is not null;

create or replace function public.protect_published_kb_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status in ('published', 'archived') and (
    new.article_id is distinct from old.article_id or
    new.version_number is distinct from old.version_number or
    new.version_label is distinct from old.version_label or
    new.content_markdown is distinct from old.content_markdown or
    new.source_reference is distinct from old.source_reference or
    new.effective_from is distinct from old.effective_from or
    new.effective_until is distinct from old.effective_until
  ) then
    raise exception 'Published knowledge versions are immutable; create a new version';
  end if;
  return new;
end;
$$;

create trigger kb_versions_protect_published
  before update on public.kb_article_versions
  for each row execute function public.protect_published_kb_version();

create trigger kb_articles_set_updated_at before update on public.kb_articles for each row execute function public.set_updated_at();

commit;
