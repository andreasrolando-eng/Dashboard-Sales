-- Adds menuCategoryDetailID/menuCategoryDetailName as a second filter level
-- under category (a menu item is always tied to both a category AND a
-- category-detail in the raw ESB data, e.g. category "GI Dessert" / detail
-- "GI Cake" per supabase/seed.sql). Same ID-not-name reasoning as migration
-- 20260814090000 applies here too -- category_detail_id is the filter key,
-- category_detail_name is display-only, derived per-ID via mode().
--
-- v_sales_product_daily only gets 2 NEW columns appended at the very end
-- (category_detail_id, category_detail) -- existing column names/order are
-- untouched, so `create or replace view` is fine here, no drop needed.
create or replace view v_sales_product_daily as
select
  m.sales_date,
  m.branch_code,
  m.menu_id,
  m.menu_name,
  m.menu_category_id as category_id,
  m.menu_category_name as category,
  sum(m.qty) as qty,
  sum(m.total) as revenue,
  m.menu_category_detail_id as category_detail_id,
  m.menu_category_detail_name as category_detail
from raw_sales_menu_items m
join raw_sales s on s.sales_num = m.sales_num
where s.status_name = 'Finished'
group by m.sales_date, m.branch_code, m.menu_id, m.menu_name, m.menu_category_id, m.menu_category_name, m.menu_category_detail_id, m.menu_category_detail_name;

-- Dimension helper for the new category-detail filter dropdown, same shape
-- as v_categories.
create view v_category_details as
select
  category_detail_id,
  mode() within group (order by category_detail) as category_detail_name
from v_sales_product_daily
where category_detail_id is not null
group by category_detail_id
order by category_detail_name;

-- fn_menu_performance needs a new input param AND a new output column, so
-- unlike the view above this can't stay `create or replace` -- Postgres
-- disallows changing a function's result rowtype that way (SQLSTATE 42P13
-- territory again, this time for the return type instead of a param name).
-- Drop and recreate, same recipe as 20260814090000: reissue the
-- `authenticated` execute grant afterwards since drop revokes it.
drop function if exists fn_menu_performance(date, date, text, text, numeric);

create function fn_menu_performance(
  p_date_start date,
  p_date_end date,
  p_outlet text default null,
  p_category_id text default null,
  p_category_detail_id text default null,
  p_threshold numeric default 300
)
returns table (
  menu_id text,
  menu_name text,
  category text,
  category_detail text,
  qty numeric,
  revenue numeric,
  contribution_pct numeric,
  trend text,
  is_takeout_candidate boolean
)
language sql
stable
as $$
  with period_days as (
    select (p_date_end - p_date_start + 1) as days
  ),
  prev_range as (
    select
      (p_date_start - (select days from period_days)) as prev_start,
      (p_date_start - 1) as prev_end
  ),
  current_agg as (
    select
      v.menu_id, v.menu_name, v.category_id, v.category, v.category_detail_id, v.category_detail,
      sum(v.qty) as qty, sum(v.revenue) as revenue
    from v_sales_product_daily v
    where v.sales_date between p_date_start and p_date_end
      and (p_outlet is null or v.branch_code = p_outlet)
    group by v.menu_id, v.menu_name, v.category_id, v.category, v.category_detail_id, v.category_detail
  ),
  previous_agg as (
    select v.menu_id, sum(v.qty) as qty
    from v_sales_product_daily v, prev_range r
    where v.sales_date between r.prev_start and r.prev_end
      and (p_outlet is null or v.branch_code = p_outlet)
    group by v.menu_id
  ),
  total_rev as (
    -- Contribution % is against ALL products in scope, not just the
    -- category/category-detail-filtered subset (FR-22: "% dari total
    -- revenue produk").
    select sum(revenue) as total from current_agg
  )
  select
    c.menu_id,
    c.menu_name,
    c.category,
    c.category_detail,
    c.qty,
    c.revenue,
    round(c.revenue / nullif((select total from total_rev), 0) * 100, 1) as contribution_pct,
    case
      when p.qty is null then 'stagnan'
      when c.qty > p.qty * 1.1 then 'naik'
      when c.qty < p.qty * 0.9 then 'turun'
      else 'stagnan'
    end as trend,
    (c.qty < p_threshold) as is_takeout_candidate
  from current_agg c
  left join previous_agg p on p.menu_id = c.menu_id
  where (p_category_id is null or c.category_id = p_category_id)
    and (p_category_detail_id is null or c.category_detail_id = p_category_detail_id)
  order by c.qty asc;
$$;

create index if not exists idx_raw_sales_menu_items_category_detail_id on raw_sales_menu_items (menu_category_detail_id);

-- v_sales_product_daily wasn't dropped, so its existing grant survives --
-- only the brand-new view and the recreated function need (re)granting.
grant select on v_category_details to authenticated;
grant execute on function fn_menu_performance(date, date, text, text, text, numeric) to authenticated;
