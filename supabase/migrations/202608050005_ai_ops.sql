begin;

create table public.ai_tool_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.conversation_sessions(id) on delete set null,
  message_id uuid references public.conversation_messages(id) on delete set null,
  tool_name text not null,
  status public.tool_run_status not null default 'queued',
  input_json jsonb not null default '{}'::jsonb,
  output_summary jsonb,
  source_label text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_code text,
  request_id uuid not null default gen_random_uuid(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  message_id uuid not null references public.conversation_messages(id) on delete cascade,
  rating public.feedback_rating not null,
  reason text check (reason is null or reason in ('incorrect', 'not_relevant', 'missing_source', 'unsafe', 'outdated', 'other')),
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (message_id, user_id)
);

create table public.knowledge_candidates (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('low_confidence', 'no_result', 'user_feedback', 'repeated_question', 'human_correction')),
  source_session_id uuid references public.conversation_sessions(id) on delete set null,
  source_message_id uuid references public.conversation_messages(id) on delete set null,
  normalized_question text not null,
  domain text check (domain is null or domain in ('housing', 'group_buy', 'market', 'platform')),
  reason text not null,
  draft_answer text,
  evidence_json jsonb not null default '[]'::jsonb,
  status public.knowledge_candidate_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.knowledge_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.knowledge_candidates(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('approve', 'reject', 'request_changes')),
  notes text not null default '',
  created_article_id uuid references public.kb_articles(id) on delete set null,
  created_version_id uuid references public.kb_article_versions(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.ai_eval_cases (
  id uuid primary key default gen_random_uuid(),
  case_key text not null unique,
  category text not null check (category in ('routing', 'business', 'rag', 'multi_tool', 'safety', 'no_answer')),
  input_json jsonb not null,
  expected_json jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.ai_eval_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.ai_eval_cases(id) on delete cascade,
  configuration_json jsonb not null,
  actual_json jsonb not null,
  passed boolean not null,
  score numeric(5, 4) check (score is null or score between 0 and 1),
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create index tool_runs_session_idx on public.ai_tool_runs (session_id, created_at);
create index feedback_message_idx on public.ai_feedback (message_id);
create index candidates_queue_idx on public.knowledge_candidates (status, created_at);
create index eval_runs_case_idx on public.ai_eval_runs (case_id, created_at desc);

create trigger candidates_set_updated_at before update on public.knowledge_candidates for each row execute function public.set_updated_at();
create trigger eval_cases_set_updated_at before update on public.ai_eval_cases for each row execute function public.set_updated_at();

commit;
