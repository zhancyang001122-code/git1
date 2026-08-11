begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

select has_table(
  'public',
  'knowledge_index_jobs',
  'durable knowledge index queue exists'
);
select has_function(
  'public',
  'enqueue_knowledge_index_job',
  array['uuid', 'uuid', 'uuid'],
  'knowledge index enqueue function exists'
);
select has_function(
  'public',
  'claim_knowledge_index_job',
  array['uuid', 'integer'],
  'knowledge index claim function exists'
);
select has_function(
  'public',
  'complete_knowledge_index_job',
  array['uuid', 'uuid', 'jsonb'],
  'knowledge index completion function exists'
);
select has_function(
  'public',
  'fail_knowledge_index_job',
  array['uuid', 'uuid', 'text', 'boolean', 'integer'],
  'knowledge index failure function exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.claim_knowledge_index_job(uuid, integer)',
    'execute'
  ),
  'anon cannot claim knowledge index jobs'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_knowledge_index_job(uuid, integer)',
    'execute'
  ),
  'service role can claim knowledge index jobs'
);

select has_column(
  'public',
  'knowledge_candidates',
  'draft_json',
  'candidate draft is stored as structured JSON'
);
select has_column(
  'public',
  'knowledge_candidates',
  'publication_result_json',
  'publication result is persisted'
);
select has_function(
  'public',
  'save_knowledge_candidate_draft',
  array['uuid', 'jsonb'],
  'draft save function exists'
);
select has_function(
  'public',
  'review_knowledge_candidate',
  array['uuid', 'text', 'text', 'jsonb'],
  'review function exists'
);
select has_function(
  'public',
  'prepare_knowledge_publication',
  array['uuid'],
  'publication preparation function exists'
);
select has_function(
  'public',
  'publish_knowledge_candidate',
  array['uuid', 'uuid', 'uuid'],
  'candidate publication function exists'
);
select has_function(
  'public',
  'rollback_knowledge_candidate',
  array['uuid'],
  'candidate rollback function exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.prepare_knowledge_publication(uuid)',
    'execute'
  ),
  'anon cannot prepare knowledge publication'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.prepare_knowledge_publication(uuid)',
    'execute'
  ),
  'service role can prepare knowledge publication'
);

select public.enqueue_knowledge_candidate(
  'human_correction',
  null,
  null,
  '押金扣款需要哪些证据',
  'housing',
  'missing_source',
  '[]'::jsonb
) as candidate_id \gset candidate_

select lives_ok(
  format(
    $$select public.save_knowledge_candidate_draft(%L, %L::jsonb)$$,
    :'candidate_candidate_id',
    '{"title":"押金扣款证据清单","answerMarkdown":"应核对合同条款、退租验收记录和费用凭证。","changeSummary":"补充证据要求","sourceReference":"PORTFOLIO-HOUSING-001","owner":"知识运营负责人","domain":"housing","category":"deposit","effectiveFrom":"2026-08-12"}'
  ),
  'validated draft can be saved'
);
select is(
  (select status::text from public.knowledge_candidates where id = :'candidate_candidate_id'),
  'drafted',
  'saving a draft changes candidate status'
);

select public.review_knowledge_candidate(
  :'candidate_candidate_id',
  'approve',
  '来源已核对，可发布',
  (select draft_json from public.knowledge_candidates where id = :'candidate_candidate_id')
) as review_id \gset review_

select is(
  (select status::text from public.knowledge_candidates where id = :'candidate_candidate_id'),
  'approved',
  'approval changes candidate status'
);
select is(
  (select count(*) from public.knowledge_reviews where id = :'review_review_id'),
  1::bigint,
  'approval writes an audit review row'
);

select *
from public.prepare_knowledge_publication(:'candidate_candidate_id')
\gset publication_

select ok(
  :'publication_article_id'::uuid is not null
  and :'publication_version_id'::uuid is not null,
  'preparation returns article and version ids'
);
select is(
  (
    select status::text
    from public.kb_article_versions
    where id = :'publication_version_id'
  ),
  'reviewing',
  'prepared version is not searchable before publication'
);
select is(
  (
    select created_version_id
    from public.knowledge_reviews
    where id = :'review_review_id'
  ),
  :'publication_version_id'::uuid,
  'review row links to the prepared version'
);

select lives_ok(
  format(
    $$select public.publish_knowledge_candidate(%L, %L, %L)$$,
    :'candidate_candidate_id',
    :'publication_article_id',
    :'publication_version_id'
  ),
  'approved candidate can be published'
);
select is(
  (select status::text from public.knowledge_candidates where id = :'candidate_candidate_id'),
  'published',
  'candidate becomes published'
);
select is(
  (
    select current_version_id
    from public.kb_articles
    where id = :'publication_article_id'
  ),
  :'publication_version_id'::uuid,
  'article points at the published version'
);
select is(
  (
    select status::text
    from public.kb_article_versions
    where id = :'publication_version_id'
  ),
  'published',
  'prepared version becomes published'
);
select is(
  (
    select count(*)
    from public.knowledge_index_jobs
    where version_id = :'publication_version_id'
  ),
  1::bigint,
  'publication atomically creates one durable index job'
);

select *
from public.claim_knowledge_index_job(
  '68000000-0000-4000-8000-000000000001',
  55
)
\gset first_claim_

select is(
  :'first_claim_status'::text,
  'processing'::text,
  'claim leases a pending job'
);
select is(
  :'first_claim_attempt_count'::integer,
  1,
  'claim increments the attempt count'
);

select *
from public.fail_knowledge_index_job(
  :'first_claim_id',
  '68000000-0000-4000-8000-000000000001',
  'TEST_RETRYABLE',
  true,
  0
)
\gset first_failure_

select is(
  :'first_failure_status'::text,
  'retrying'::text,
  'retryable failure releases the job'
);

select *
from public.claim_knowledge_index_job(
  '68000000-0000-4000-8000-000000000002',
  55
)
\gset second_claim_

select is(
  :'second_claim_attempt_count'::integer,
  2,
  'a released job can be claimed again'
);

select *
from public.complete_knowledge_index_job(
  :'second_claim_id',
  '68000000-0000-4000-8000-000000000002',
  '{"indexedChunks":1}'::jsonb
)
\gset completed_job_

select is(
  :'completed_job_status'::text,
  'succeeded'::text,
  'the lease owner can complete a job'
);

select *
from public.enqueue_knowledge_index_job(
  :'candidate_candidate_id',
  :'publication_version_id',
  null
)
\gset repeated_enqueue_

select is(
  :'repeated_enqueue_id'::uuid,
  :'completed_job_id'::uuid,
  'repeated enqueue is idempotent per version'
);
select is(
  :'repeated_enqueue_status'::text,
  'succeeded'::text,
  'repeated enqueue does not reset a completed job'
);

select throws_ok(
  $$select * from public.prepare_knowledge_publication('00000000-0000-4000-8000-000000000099')$$,
  'P0001',
  'Knowledge candidate is not approved',
  'unknown or unapproved candidates cannot be published'
);

select public.enqueue_knowledge_candidate(
  'human_correction',
  null,
  null,
  '押金扣款证据清单需要更新吗',
  'housing',
  'policy_update',
  '[]'::jsonb
) as candidate_id \gset replacement_

select public.save_knowledge_candidate_draft(
  :'replacement_candidate_id',
  '{"title":"押金扣款证据清单（更新）","answerMarkdown":"除合同、验收记录和费用凭证外，还应记录双方确认时间。","changeSummary":"补充双方确认时间","sourceReference":"PORTFOLIO-HOUSING-002","owner":"知识运营负责人","domain":"housing","category":"deposit","effectiveFrom":"2026-08-13"}'::jsonb
);
select public.review_knowledge_candidate(
  :'replacement_candidate_id',
  'approve',
  '更新来源已核对',
  (select draft_json from public.knowledge_candidates where id = :'replacement_candidate_id')
);
select *
from public.prepare_knowledge_publication(:'replacement_candidate_id')
\gset replacement_publication_

select is(
  :'replacement_publication_previous_version_id'::uuid,
  :'publication_version_id'::uuid,
  'replacement publication points to the previous active version'
);
select lives_ok(
  format(
    $$select public.publish_knowledge_candidate(%L, %L, %L)$$,
    :'replacement_candidate_id',
    :'replacement_publication_article_id',
    :'replacement_publication_version_id'
  ),
  'replacement version can be published'
);
select is(
  (select status::text from public.kb_article_versions where id = :'publication_version_id'),
  'archived',
  'publishing a replacement archives the previous version'
);
select lives_ok(
  format(
    $$select * from public.rollback_knowledge_candidate(%L)$$,
    :'replacement_candidate_id'
  ),
  'replacement can roll back to the previous version'
);
select is(
  (select current_version_id from public.kb_articles where id = :'publication_article_id'),
  :'publication_version_id'::uuid,
  'rollback restores the previous article version'
);
select is(
  (select status::text from public.kb_article_versions where id = :'publication_version_id'),
  'published',
  'rollback republishes the previous version'
);
select is(
  (select status::text from public.kb_article_versions where id = :'replacement_publication_version_id'),
  'archived',
  'rollback archives the replacement version'
);
select is(
  (
    select publication_result_json ->> 'rolledBack'
    from public.knowledge_candidates
    where id = :'replacement_candidate_id'
  ),
  'true',
  'rollback is recorded on the knowledge candidate'
);

select * from finish();
rollback;
