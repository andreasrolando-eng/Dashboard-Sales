-- Pre-aggregated sales views, grained by day so an arbitrary date-range
-- filter is just a SUM over a handful of rows (NFR: "dashboard tetap
-- responsif meski data difilter (query lewat pre-aggregated views)").
--
-- Filter scope matches the design reference exactly: outlet + date range
-- filter everything; the product-category filter only ever applies to
-- product-grain data (top seller/slow mover/menu underperforming), never to
-- the top-line revenue/transaction KPIs -- see v_sales_daily_outlet below,
-- which has no category dimension at all.

create or replace view v_sales_daily_outlet as
select
  sales_date,
  branch_code,
  sum(grand_total) filter (where status_name = 'Finished') as revenue,
  count(*) filter (where status_name = 'Finished') as trans_count,
  sum(grand_total) filter (
    where status_name = 'Finished' and member_code is not null
  ) as member_revenue,
  -- Non-promo revenue/count, used as the baseline for promo lift/ROI in
  -- fn_promo_performance. Additive across days, so summing over an
  -- arbitrary range still gives a correct baseline average.
  sum(grand_total) filter (
    where status_name = 'Finished' and (promotion_id is null or promotion_id = '0')
  ) as non_promo_revenue,
  count(*) filter (
    where status_name = 'Finished' and (promotion_id is null or promotion_id = '0')
  ) as non_promo_trans_count
from raw_sales
group by sales_date, branch_code;

create or replace view v_sales_hourly_outlet as
select
  sales_date,
  branch_code,
  extract(hour from sales_date_in)::int as hour_of_day,
  sum(grand_total) filter (where status_name = 'Finished') as revenue,
  count(*) filter (where status_name = 'Finished') as trans_count
from raw_sales
where sales_date_in is not null
group by sales_date, branch_code, extract(hour from sales_date_in)::int;

create or replace view v_sales_product_daily as
select
  m.sales_date,
  m.branch_code,
  m.menu_id,
  m.menu_name,
  m.menu_category_name as category,
  sum(m.qty) as qty,
  sum(m.total) as revenue
from raw_sales_menu_items m
join raw_sales s on s.sales_num = m.sales_num
where s.status_name = 'Finished'
group by m.sales_date, m.branch_code, m.menu_id, m.menu_name, m.menu_category_name;

create or replace view v_promo_daily as
select
  sales_date,
  branch_code,
  promotion_id,
  promotion_name,
  count(*) as redemptions,
  sum(grand_total) as promo_revenue,
  sum(discount_total) as discount_cost
from raw_sales
where status_name = 'Finished'
  and promotion_id is not null
  and promotion_id <> '0'
group by sales_date, branch_code, promotion_id, promotion_name;

-- Dimension helpers for populating the outlet/category filter dropdowns.
-- Categories are real ESB menuCategoryName values (outlet-specific), NOT the
-- 4 hardcoded buckets in the design mock -- see plan notes.
create or replace view v_outlets as
select branch_code, branch_name from outlets;

create or replace view v_categories as
select distinct category from v_sales_product_daily where category is not null;
