-- RPC functions for the analyses that need cross-period comparison, not just
-- a straight sum over the daily grain views (FR-21-32). Each is built
-- entirely on top of the additive views in the previous two migrations, so
-- they run as SECURITY INVOKER (default) -- no elevated privileges needed,
-- the views already broker access to the underlying raw tables.

-- FR-21-24: menu underperforming / takeout-candidate analysis. Trend is the
-- current period vs. the immediately preceding period of equal length, same
-- outlet scope, +/-10% band. threshold is the adjustable takeout cutoff
-- (design: <input type=range min=100 max=1000 step=50>).
create or replace function fn_menu_performance(
  p_date_start date,
  p_date_end date,
  p_outlet text default null,
  p_category text default null,
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
    select v.menu_id, v.menu_name, v.category, sum(v.qty) as qty, sum(v.revenue) as revenue
    from v_sales_product_daily v
    where v.sales_date between p_date_start and p_date_end
      and (p_outlet is null or v.branch_code = p_outlet)
    group by v.menu_id, v.menu_name, v.category
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
  where p_category is null or c.category = p_category
  order by c.qty asc;
$$;

-- FR-25-29: promo lift vs. non-promo baseline + ROI. Both promo revenue and
-- the baseline are additive daily sums (v_promo_daily / v_sales_daily_outlet
-- non_promo_*), so avg-per-bill over an arbitrary range is just
-- sum(revenue)/sum(count) -- no need to touch raw_sales per-transaction.
create or replace function fn_promo_performance(
  p_date_start date,
  p_date_end date,
  p_outlet text default null
)
returns table (
  promotion_id text,
  promotion_name text,
  redemptions bigint,
  promo_revenue numeric,
  discount_cost numeric,
  lift_pct numeric,
  roi numeric,
  status text
)
language sql
stable
as $$
  with baseline as (
    select
      sum(non_promo_revenue) as revenue,
      sum(non_promo_trans_count) as trans_count
    from v_sales_daily_outlet
    where sales_date between p_date_start and p_date_end
      and (p_outlet is null or branch_code = p_outlet)
  ),
  baseline_avg as (
    select
      case when trans_count > 0 then revenue / trans_count else 0 end as avg_grand_total
    from baseline
  ),
  promo_agg as (
    select
      v.promotion_id,
      v.promotion_name,
      sum(v.redemptions) as redemptions,
      sum(v.promo_revenue) as promo_revenue,
      sum(v.discount_cost) as discount_cost
    from v_promo_daily v
    where v.sales_date between p_date_start and p_date_end
      and (p_outlet is null or v.branch_code = p_outlet)
    group by v.promotion_id, v.promotion_name
  ),
  calc as (
    select
      p.promotion_id,
      p.promotion_name,
      p.redemptions,
      p.promo_revenue,
      p.discount_cost,
      case when p.redemptions > 0 then p.promo_revenue / p.redemptions else 0 end as avg_promo_bill,
      ba.avg_grand_total as baseline_avg
    from promo_agg p, baseline_avg ba
  )
  select
    promotion_id,
    promotion_name,
    redemptions,
    promo_revenue,
    discount_cost,
    round((avg_promo_bill - baseline_avg) / nullif(baseline_avg, 0) * 100, 1) as lift_pct,
    round(coalesce((promo_revenue - redemptions * baseline_avg) / nullif(discount_cost, 0), 0), 2) as roi,
    case
      when (avg_promo_bill - baseline_avg) / nullif(baseline_avg, 0) * 100 >= 15
       and coalesce((promo_revenue - redemptions * baseline_avg) / nullif(discount_cost, 0), 0) >= 2
      then 'Efektif'
      else 'Kurang Efektif'
    end as status
  from calc
  order by redemptions desc;
$$;

-- FR-11-14: total/active/churn/retention/visit-frequency in one call.
-- Active = last visit within 60 days of the period end. Retention = members
-- who visited in the first half of the selected period AND the second half,
-- over members who visited in the first half (a period-relative repeat-rate,
-- not a hardcoded window).
create or replace function fn_membership_summary(
  p_date_start date,
  p_date_end date,
  p_outlet text default null
)
returns table (
  total_members bigint,
  active_members bigint,
  active_pct numeric,
  churn_pct numeric,
  retention_pct numeric,
  visit_frequency numeric
)
language sql
stable
as $$
  with scope as (
    select * from v_members_dim
    where p_outlet is null or home_branch_code = p_outlet
  ),
  totals as (
    select count(*) as total, count(*) filter (where last_seen_date >= (p_date_end - 60)) as active
    from scope
  ),
  mid as (
    select p_date_start + floor((p_date_end - p_date_start) / 2.0)::int as mid_date
  ),
  first_half as (
    select distinct v.member_code
    from v_member_visits_daily v, mid
    where v.sales_date between p_date_start and mid.mid_date
      and (p_outlet is null or v.branch_code = p_outlet)
  ),
  second_half as (
    select distinct v.member_code
    from v_member_visits_daily v, mid
    where v.sales_date > mid.mid_date and v.sales_date <= p_date_end
      and (p_outlet is null or v.branch_code = p_outlet)
  ),
  retained as (
    select count(*) as n
    from first_half f
    where exists (select 1 from second_half s where s.member_code = f.member_code)
  ),
  period_visits as (
    select v.member_code, sum(v.visit_count) as visits
    from v_member_visits_daily v
    where v.sales_date between p_date_start and p_date_end
      and (p_outlet is null or v.branch_code = p_outlet)
    group by v.member_code
  ),
  span as (
    select greatest((p_date_end - p_date_start + 1) / 30.0, 1.0) as months
  )
  select
    totals.total as total_members,
    totals.active as active_members,
    round(totals.active::numeric / nullif(totals.total, 0) * 100, 1) as active_pct,
    round(100 - (totals.active::numeric / nullif(totals.total, 0) * 100), 1) as churn_pct,
    round(retained.n::numeric / nullif((select count(*) from first_half), 0) * 100, 1) as retention_pct,
    round(coalesce((select avg(visits) from period_visits), 0) / (select months from span), 1) as visit_frequency
  from totals, retained;
$$;

-- FR-15: top members by spending within the selected period/outlet. Scoped
-- to "transacted at this outlet during the period" rather than strictly
-- "home outlet", so the date-range filter isn't a no-op for this table.
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
  spending numeric
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
  )
  select a.member_code, d.member_name, d.home_branch_name as outlet_name, d.tier, a.visits, a.spending
  from agg a
  join v_members_dim d on d.member_code = a.member_code
  order by a.spending desc
  limit p_limit;
$$;
