begin;

alter table public.stores enable row level security;
alter table public.houses enable row level security;
alter table public.deals enable row level security;
alter table public.products enable row level security;
alter table public.product_inventory enable row level security;
alter table public.community_posts enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_addresses enable row level security;
alter table public.favorites enable row level security;
alter table public.cart_items enable row level security;
alter table public.demo_orders enable row level security;
alter table public.demo_order_items enable row level security;
alter table public.notifications enable row level security;
alter table public.conversation_sessions enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.kb_categories enable row level security;
alter table public.kb_articles enable row level security;
alter table public.kb_article_versions enable row level security;
alter table public.kb_chunks enable row level security;
alter table public.ai_tool_runs enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.knowledge_candidates enable row level security;
alter table public.knowledge_reviews enable row level security;
alter table public.ai_eval_cases enable row level security;
alter table public.ai_eval_runs enable row level security;

create policy stores_public_read on public.stores for select to anon, authenticated using (active = true);
create policy houses_public_read on public.houses for select to anon, authenticated using (available = true);
create policy deals_public_read on public.deals for select to anon, authenticated using (active = true and valid_until >= current_date);
create policy products_public_read on public.products for select to anon, authenticated using (active = true);
create policy inventory_public_read on public.product_inventory for select to anon, authenticated using (true);
create policy posts_public_read on public.community_posts for select to anon, authenticated using (published = true);

create policy profiles_own_read on public.user_profiles for select to authenticated using (id = auth.uid());
create policy profiles_own_update on public.user_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy preferences_own_all on public.user_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_own_all on public.user_addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy favorites_own_all on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_own_all on public.cart_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy orders_own_read on public.demo_orders for select to authenticated using (user_id = auth.uid());
create policy order_items_own_read on public.demo_order_items for select to authenticated using (
  exists (select 1 from public.demo_orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy sessions_own_read on public.conversation_sessions for select to authenticated using (user_id = auth.uid());
create policy sessions_own_insert on public.conversation_sessions for insert to authenticated with check (user_id = auth.uid());
create policy sessions_own_update on public.conversation_sessions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy messages_own_read on public.conversation_messages for select to authenticated using (
  exists (select 1 from public.conversation_sessions s where s.id = session_id and s.user_id = auth.uid())
);
create policy messages_own_insert on public.conversation_messages for insert to authenticated with check (
  exists (select 1 from public.conversation_sessions s where s.id = session_id and s.user_id = auth.uid())
);

create policy kb_categories_public_read on public.kb_categories for select to anon, authenticated using (true);
create policy kb_articles_public_read on public.kb_articles for select to anon, authenticated using (status = 'published');
create policy kb_versions_public_read on public.kb_article_versions for select to anon, authenticated using (
  status = 'published'
  and (effective_from is null or effective_from <= current_date)
  and (effective_until is null or effective_until >= current_date)
);
-- kb_chunks has no client policy; retrieval runs through server-only Knowledge Service.
create policy feedback_own_insert on public.ai_feedback for insert to authenticated with check (user_id = auth.uid());
create policy feedback_own_read on public.ai_feedback for select to authenticated using (user_id = auth.uid());

-- No client policies are created for tool logs, candidates, reviews or evaluation tables.
-- They are accessed through server-only routes with service_role and explicit application authorization.

commit;
