-- Real hierarchy confirmed in raw data: category > category_detail > menu
-- (each category_detail_id belongs to exactly one category_id -- e.g.
-- "Nasi Goreng" detail always sits under the "Makanans" category). But
-- v_category_details was flat (no parent category_id), so the detail
-- dropdown couldn't be scoped to the currently selected category. Add
-- category_id as a new trailing column, sourced from the same raw record
-- (most recent sales_date) as category_detail_name -- appended at the end,
-- so `create or replace view` is fine here, no drop needed.
create or replace view v_category_details as
select distinct on (category_detail_id)
  category_detail_id,
  category_detail as category_detail_name,
  category_id
from v_sales_product_daily
where category_detail_id is not null
order by category_detail_id, sales_date desc;
