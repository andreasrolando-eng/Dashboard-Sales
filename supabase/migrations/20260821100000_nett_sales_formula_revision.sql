-- Nett Sales formula revision (business decision, supersedes
-- 20260813100200_nett_sales_more_deductions.sql and the nett_sales part of
-- 20260820090000_category_filtered_revenue.sql): base changed from
-- grand_total to subtotal, and the deduction set narrowed to tax/vat +
-- discount_total + rounding_total only -- voucher_discount_total, order_fee
-- (platform fee), and delivery_cost are no longer subtracted.
--
-- nett_sales = subtotal
--            - (other_tax_total + vat_total + other_vat_total)
--            - discount_total
--            - rounding_total
--
-- Column name/position is unchanged (still `nett_sales`, still last column
-- in both views), so `create or replace view` is fine here, no drop needed.
create or replace view v_sales_daily_outlet as
select
  sales_date,
  branch_code,
  sum(grand_total) filter (where status_name = 'Finished') as revenue,
  count(*) filter (where status_name = 'Finished') as trans_count,
  sum(grand_total) filter (
    where status_name = 'Finished' and member_code is not null
  ) as member_revenue,
  sum(grand_total) filter (
    where status_name = 'Finished' and (promotion_id is null or promotion_id = '0')
  ) as non_promo_revenue,
  count(*) filter (
    where status_name = 'Finished' and (promotion_id is null or promotion_id = '0')
  ) as non_promo_trans_count,
  sum(
    subtotal
    - other_tax_total - vat_total - other_vat_total
    - discount_total
    - rounding_total
  ) filter (where status_name = 'Finished') as nett_sales
from raw_sales
group by sales_date, branch_code;

-- v_sales_daily_outlet_category allocates nett_sales proportionally from
-- each transaction's nett_sales (same allocation mechanism as
-- 20260820090000_category_filtered_revenue.sql -- see that migration's
-- comment for why proportional allocation is used at all). Only the
-- per-transaction nett_sales formula in tx_nett changes here.
create or replace view v_sales_daily_outlet_category as
with tx_nett as (
  select
    sales_num,
    subtotal
      - other_tax_total - vat_total - other_vat_total
      - discount_total
      - rounding_total as nett_sales
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
