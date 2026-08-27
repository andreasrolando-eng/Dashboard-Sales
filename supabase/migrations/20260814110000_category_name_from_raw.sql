-- Category/category-detail display names now come straight from raw data
-- instead of mode() (a computed "most common name" -- still one of the real
-- values, but a statistical pick rather than a specific raw record). Use the
-- name from the MOST RECENT sales_date on record for that ID instead, so the
-- dropdown reflects whatever the category is currently called in ESB if it
-- was ever renamed. Column list is unchanged (still category_id+category_name
-- / category_detail_id+category_detail_name), so `create or replace view`
-- is fine here -- no drop needed.
create or replace view v_categories as
select distinct on (category_id)
  category_id,
  category as category_name
from v_sales_product_daily
where category_id is not null
order by category_id, sales_date desc;

create or replace view v_category_details as
select distinct on (category_detail_id)
  category_detail_id,
  category_detail as category_detail_name
from v_sales_product_daily
where category_detail_id is not null
order by category_detail_id, sales_date desc;
