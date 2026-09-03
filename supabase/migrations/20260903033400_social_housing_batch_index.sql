begin;

create index social_housing_sources_batch_idx
  on public.social_housing_lead_sources (batch_id);

commit;
