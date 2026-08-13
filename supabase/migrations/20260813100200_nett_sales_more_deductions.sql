-- Extends nett_sales with platform fee, other cost, and delivery cost
-- deductions. Same column name/position/type as before, so CREATE OR
-- REPLACE VIEW just needs the updated expression -- no reordering issue
-- this time (see 20260813100100 for why order mattered there).
--
-- nett_sales = grand_total - (other_tax_total + vat_total + other_vat_total)
--                           - (discount_total + voucher_discount_total)
--                           - order_fee (platform fee)
--                           - rounding_total (other cost)
--                           - delivery_cost
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
    grand_total
    - other_tax_total - vat_total - other_vat_total
    - discount_total - voucher_discount_total
    - order_fee - rounding_total - delivery_cost
  ) filter (where status_name = 'Finished') as nett_sales
from raw_sales
group by sales_date, branch_code;
