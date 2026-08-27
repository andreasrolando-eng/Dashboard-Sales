-- Sales tab's Total Revenue/Nett Sales KPIs need to follow the
-- category/category-detail filter; Overview keeps using v_sales_daily_outlet
-- unfiltered by category, as documented in 20260813090300_sales_views.sql.
--
-- raw_sales' nett_sales deductions (tax, discount, platform fee, rounding,
-- delivery) only exist at the transaction grain, not per line item, so
-- there's no exact "nett_sales of this menu item". Allocate each
-- transaction's nett_sales across its line items in proportion to the
-- item's share of that transaction's item-total (sum of
-- raw_sales_menu_items.total) -- this preserves additivity: summing every
-- category back together for a transaction reproduces its transaction-grain
-- nett_sales exactly. Falls back to 0 for the (rare) transaction whose items
-- all have total = 0, to avoid a division by zero.
--
-- revenue here is sum(raw_sales_menu_items.total), the same per-item revenue
-- definition v_sales_product_daily already uses for Top Seller/Slow Mover --
-- not sum(grand_total) like v_sales_daily_outlet. The two are not
-- guaranteed to match to the rupiah (grand_total can include amounts not
-- tied to any line item), which is why the frontend only switches to this
-- view once a category/category-detail filter is actually active, keeping
-- the default "Semua Kategori" numbers exactly as they are today.
create view v_sales_daily_outlet_category as
with tx_nett as (
  select
    sales_num,
    grand_total
      - other_tax_total - vat_total - other_vat_total
      - discount_total - voucher_discount_total
      - order_fee - rounding_total - delivery_cost as nett_sales
  from raw_sales
  where status_name = 'Finished'
),
tx_item_total as (
  select sales_num, sum(total) as item_total
  from raw_sales_menu_items
  group by sales_num
)
select
  m.sales_date,
  m.branch_code,
  m.menu_category_id as category_id,
  m.menu_category_detail_id as category_detail_id,
  sum(m.total) as revenue,
  sum(
    m.total * case when it.item_total <> 0 then n.nett_sales / it.item_total else 0 end
  ) as nett_sales
from raw_sales_menu_items m
join tx_nett n on n.sales_num = m.sales_num
join tx_item_total it on it.sales_num = m.sales_num
group by m.sales_date, m.branch_code, m.menu_category_id, m.menu_category_detail_id;

grant select on v_sales_daily_outlet_category to authenticated;
