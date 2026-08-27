-- Category filter now keys off menuCategoryID instead of menuCategoryName.
-- ESB's category NAME isn't guaranteed stable the way the ID is (same
-- category can resurface with different spelling/casing across syncs), so
-- text-equality filtering on the name is fragile in the same way
-- salesNum+menuID+batchID turned out to be for line items (see migration
-- 20260813100000). menuCategoryID is the reliable key; menuCategoryName is
-- kept only as the display label, derived per-ID via mode() so the dropdown
-- shows the most common name on record for that category.
--
-- v_sales_product_daily needs a new column (category_id) inserted BEFORE the
-- existing category column, and v_categories needs its single `category`
-- column split into two -- neither is possible via `create or replace view`
-- (Postgres only allows appending columns at the end, never renaming/
-- reordering existing ones). Drop-and-recreate instead; CASCADE takes
-- v_categories down with it too since it selects from v_sales_product_daily
-- (fn_menu_performance is NOT cascaded -- a plain LANGUAGE SQL function's
-- body isn't catalog-tracked as depending on objects it queries, so it's
-- handled separately below via `create or replace`). Both views'
-- `authenticated` grants are lost on drop and reissued at the end.
drop view if exists v_sales_product_daily cascade;

create view v_sales_product_daily as
select
  m.sales_date,
  m.branch_code,
  m.menu_id,
  m.menu_name,
  m.menu_category_id as category_id,
  m.menu_category_name as category,
  sum(m.qty) as qty,
  sum(m.total) as revenue
from raw_sales_menu_items m
join raw_sales s on s.sales_num = m.sales_num
where s.status_name = 'Finished'
group by m.sales_date, m.branch_code, m.menu_id, m.menu_name, m.menu_category_id, m.menu_category_name;

create view v_categories as
select
  category_id,
  mode() within group (order by category) as category_name
from v_sales_product_daily
where category_id is not null
group by category_id
order by category_name;

-- FR-21-24 menu performance: filter by category_id (the join key), still
-- returns category (name) for display. It's not cascade-dropped by the view
-- drop above (a plain LANGUAGE SQL function's body isn't catalog-tracked as
-- depending on the views/tables it queries), and `create or replace` can't
-- be used either -- Postgres rejects renaming an existing parameter
-- (p_category -> p_category_id) that way (SQLSTATE 42P13), even though the
-- argument types are unchanged. Drop and recreate explicitly instead.
drop function if exists fn_menu_performance(date, date, text, text, numeric);

create function fn_menu_performance(
  p_date_start date,
  p_date_end date,
  p_outlet text default null,
  p_category_id text default null,
  p_threshold numeric default 300
)
returns table (
  menu_id text,
  menu_name text,
  category text,
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
    select v.menu_id, v.menu_name, v.category_id, v.category, sum(v.qty) as qty, sum(v.revenue) as revenue
    from v_sales_product_daily v
    where v.sales_date between p_date_start and p_date_end
      and (p_outlet is null or v.branch_code = p_outlet)
    group by v.menu_id, v.menu_name, v.category_id, v.category
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
    -- category-filtered subset (FR-22: "% dari total revenue produk").
    select sum(revenue) as total from current_agg
  )
  select
    c.menu_id,
    c.menu_name,
    c.category,
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
  where p_category_id is null or c.category_id = p_category_id
  order by c.qty asc;
$$;

create index if not exists idx_raw_sales_menu_items_category_id on raw_sales_menu_items (menu_category_id);

grant select on v_sales_product_daily, v_categories to authenticated;
grant execute on function fn_menu_performance(date, date, text, text, numeric) to authenticated;
