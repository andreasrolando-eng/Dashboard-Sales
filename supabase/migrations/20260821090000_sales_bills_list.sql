-- Bill-level list for the Sales tab's transaction drill-down panel (FR: list
-- sales per transaksi/bill, sorted ascending, scoped to the selected date
-- period). Grain: 1 row = 1 bill -- unlike every other sales view here,
-- which is pre-aggregated (see 20260813090300_sales_views.sql's opening
-- comment). Scoped to status_name = 'Finished' only, same convention as
-- every other revenue number in this dashboard.
create view v_sales_bills as
select
  bill_num,
  sales_date,
  branch_code,
  grand_total
from raw_sales
where status_name = 'Finished';

grant select on v_sales_bills to authenticated;
