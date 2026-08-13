-- Membership analytics are derived entirely from memberCode/memberName on
-- raw_sales (confirmed present in the real ESB sample) -- no dedicated
-- membership endpoint sample was available. raw_members (profile dim: tier,
-- join_date) is joined in when populated by that future sync step; until
-- then tier falls back to a spending-bracket rule below so the UI still
-- works end-to-end.

create or replace view v_member_visits_daily as
select
  sales_date,
  member_code,
  branch_code,
  count(*) as visit_count,
  sum(grand_total) as spending
from raw_sales
where status_name = 'Finished' and member_code is not null
group by sales_date, member_code, branch_code;

create or replace view v_member_branch_counts as
select member_code, branch_code, sum(visit_count) as visits
from v_member_visits_daily
group by member_code, branch_code;

create or replace view v_members_dim as
with lifetime as (
  select
    member_code,
    min(sales_date) as first_seen_date,
    max(sales_date) as last_seen_date,
    sum(visit_count) as total_visits,
    sum(spending) as total_spending
  from v_member_visits_daily
  group by member_code
),
home as (
  select distinct on (member_code) member_code, branch_code as home_branch_code
  from v_member_branch_counts
  order by member_code, visits desc
),
latest_name as (
  select distinct on (member_code) member_code, member_name
  from raw_sales
  where member_code is not null and member_name is not null
  order by member_code, sales_date desc
)
select
  l.member_code,
  coalesce(rm.member_name, ln.member_name) as member_name,
  home.home_branch_code,
  o.branch_name as home_branch_name,
  l.first_seen_date,
  l.last_seen_date,
  l.total_visits,
  l.total_spending,
  coalesce(
    rm.tier,
    case
      when l.total_spending >= 5000000 then 'Gold'
      when l.total_spending >= 2000000 then 'Silver'
      else 'Bronze'
    end
  ) as tier
from lifetime l
left join home on home.member_code = l.member_code
left join outlets o on o.branch_code = home.home_branch_code
left join raw_members rm on rm.member_code = l.member_code
left join latest_name ln on ln.member_code = l.member_code;

create or replace view v_membership_new_weekly as
select
  date_trunc('week', first_seen_date)::date as week_start,
  count(*) as new_members
from v_members_dim
group by date_trunc('week', first_seen_date)::date;
