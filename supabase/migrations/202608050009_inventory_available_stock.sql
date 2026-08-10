begin;

alter table public.product_inventory
  add column available_stock integer
  generated always as (stock - reserved) stored;

create index product_inventory_available_idx
  on public.product_inventory (available_stock, product_id);

commit;
