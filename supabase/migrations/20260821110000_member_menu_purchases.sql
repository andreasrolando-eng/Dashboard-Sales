-- FR: favorite menu per member (Top Member table) + a per-member menu
-- purchase report for the Membership tab drill-down ("member ini beli menu
-- apa aja"). Both derive from raw_sales_menu_items joined to raw_sales for
-- member_code/status_name -- raw_sales_menu_items already carries
-- branch_code itself, so only the member_code + Finished-status filter needs
-- the join.

create or replace view v_member_menu_daily as
select
  s.member_code,
  m.sales_date,
  m.branch_code,
  m.menu_id,
  m.menu_name,
  sum(m.qty) as qty,
  sum(m.total) as revenue
from raw_sales_menu_items m
join raw_sales s on s.sales_num = m.sales_num
where s.status_name = 'Finished' and s.member_code is not null
group by s.member_code, m.sales_date, m.branch_code, m.menu_id, m.menu_name;

grant select on v_member_menu_daily to authenticated;

-- Adds a "Menu Favorit" column to Top Member by Spending -- the highest-qty
-- menu each member ordered within the same period/outlet scope as the rest
-- of the row (period-relative, not a lifetime favorite, so it stays
-- consistent with visits/spending on the same row).
-- Postgres won't let `create or replace` change a function's OUT columns, so
-- the old 6-column signature has to be dropped first.
drop function if exists fn_top_members(date, date, text, int);

create or replace function fn_top_members(
  p_date_start date,
  p_date_end date,
  p_outlet text default null,
  p_limit int default 8
)
returns table (
  member_code text,
  member_name text,
  outlet_name text,
  tier text,
  visits bigint,
  spending numeric,
  favorite_menu text
)
language sql
stable
as $$
  with agg as (
    select v.member_code, sum(v.visit_count) as visits, sum(v.spending) as spending
    from v_member_visits_daily v
    where v.sales_date between p_date_start and p_date_end
      and (p_outlet is null or v.branch_code = p_outlet)
    group by v.member_code
  ),
  menu_agg as (
    select v.member_code, v.menu_name, sum(v.qty) as qty
    from v_member_menu_daily v
    where v.sales_date between p_date_start and p_date_end
      and (p_outlet is null or v.branch_code = p_outlet)
    group by v.member_code, v.menu_name
  ),
  favorite as (
    select distinct on (member_code) member_code, menu_name as favorite_menu
    from menu_agg
    order by member_code, qty desc, menu_name
  )
  select a.member_code, d.member_name, d.home_branch_name as outlet_name, d.tier, a.visits, a.spending, f.favorite_menu
  from agg a
  join v_members_dim d on d.member_code = a.member_code
  left join favorite f on f.member_code = a.member_code
  order by a.spending desc
  limit p_limit;
$$;

-- Per-member menu purchase report ("member ini beli menu apa aja"). Whole
-- result set (not paginated) -- unlike v_sales_bills this is scoped to a
-- single member, so the row count is distinct menu items ordered, not one
-- row per bill, and stays small.
create or replace function fn_member_menu_purchases(
  p_member_code text,
  p_date_start date,
  p_date_end date,
  p_outlet text default null
)
returns table (
  menu_id text,
  menu_name text,
  qty numeric,
  revenue numeric,
  last_purchase_date date
)
language sql
stable
as $$
  select
    v.menu_id,
    v.menu_name,
    sum(v.qty) as qty,
    sum(v.revenue) as revenue,
    max(v.sales_date) as last_purchase_date
  from v_member_menu_daily v
  where v.member_code = p_member_code
    and v.sales_date between p_date_start and p_date_end
    and (p_outlet is null or v.branch_code = p_outlet)
  group by v.menu_id, v.menu_name
  order by qty desc;
$$;
