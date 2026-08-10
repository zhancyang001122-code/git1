begin;

grant usage on schema public to anon, authenticated, service_role;

grant select on table
  public.stores,
  public.houses,
  public.deals,
  public.products,
  public.product_inventory,
  public.community_posts,
  public.kb_categories,
  public.kb_articles,
  public.kb_article_versions
to anon, authenticated;

grant select, update on table public.user_profiles to authenticated;

grant select, insert, update, delete on table
  public.user_preferences,
  public.user_addresses,
  public.favorites,
  public.cart_items
to authenticated;

grant select on table
  public.demo_orders,
  public.demo_order_items
to authenticated;

grant select, update on table public.notifications to authenticated;
grant select, insert, update on table public.conversation_sessions to authenticated;
grant select, insert on table public.conversation_messages to authenticated;
grant select, insert, update on table public.ai_feedback to authenticated;

create policy feedback_own_update on public.ai_feedback for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on table
  public.kb_chunks,
  public.ai_tool_runs,
  public.knowledge_candidates,
  public.knowledge_reviews,
  public.ai_eval_cases,
  public.ai_eval_runs
from anon, authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

commit;
