-- Adds nett_sales alongside revenue (gross) on v_sales_daily_outlet.
-- CREATE OR REPLACE VIEW can only APPEND a new column at the end of the
-- select list -- existing columns must keep their exact name/order/type, or
-- Postgres errors with "cannot change name of view column". nett_sales goes
-- last, not next to revenue, for that reason.
--
-- nett_sales = grand_total - (other_tax_total + vat_total + other_vat_total)
--                           - (discount_total + voucher_discount_total)
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
  ) filter (where status_name = 'Finished') as nett_sales
from raw_sales
group by sales_date, branch_code;
