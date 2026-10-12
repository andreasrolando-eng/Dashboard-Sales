-- Actual COGS from ESB Core's own reports, used for every CLOSED month.
--
-- Source endpoints (written by the sync-esb-cogs Edge Function, one partition
-- = one sales date x one branch):
--   report/sales-menu-cogs        (Package Summary) -> esb_cogs_menu_lines
--   report/sales-menu-cogs-detail (mode recap)      -> esb_cogs_ingredient_lines
--
-- Rule (agreed): a sales date in a month before the current WIB month is
-- costed with ESB's actual COGS; the current month keeps the BOM-snapshot
-- estimate from 20261013090000_menu_hpp.sql. ESB only finalises COGS at its
-- month-end closing, so current-month ESB figures are 0 and never used.
--
-- ESB's own COGS can be incomplete too (an ingredient whose average cost is 0
-- at the time of sale). Such menu-days are `incomplete_cost` and excluded
-- from COGS, exactly like the BOM side -- a 0 cost is never a valid cost.

-- ---------------------------------------------------------------------------
-- Raw report rows (kept for audit and ingredient usage). menu_id is resolved
-- at publish time from our own sales lines of the same date + branch.
-- ---------------------------------------------------------------------------
create table esb_cogs_menu_lines (
  sales_date date not null,
  branch_code text not null,
  seq int not null,
  sales_num text,
  menu_code text,
  menu_name text,
  menu_id text,            -- our raw_sales_menu_items.menu_id (null = no match)
  row_type text,
  qty numeric,
  price numeric,
  total numeric,
  discount_total numeric,
  cogs_total numeric,
  sales_type text,
  primary key (sales_date, branch_code, seq)
);

create table esb_cogs_ingredient_lines (
  sales_date date not null,
  branch_code text not null,
  seq int not null,
  menu_name text,
  menu_id text,            -- resolved by name within the same date + branch
  product_name text,
  category_name text,
  sub_category_name text,
  uom_name text,
  qty_total numeric,
  value_total numeric,
  sales_type text,
  primary key (sales_date, branch_code, seq)
);

-- Per (date, branch, menu) summary the dashboard reads -- computed at publish
-- so read queries never re-match names/codes.
create table esb_cogs_menu_daily (
  sales_date date not null,
  branch_code text not null,
  menu_id text not null,
  qty numeric not null,
  cogs numeric not null,
  ingredient_rows int not null,
  invalid_ingredient_rows int not null,
  is_package boolean not null,
  primary key (sales_date, branch_code, menu_id)
);

-- One row per fetched partition: proves the partition was synced (even when
-- ESB returned nothing) and when.
create table esb_cogs_fetch_log (
  sales_date date not null,
  branch_code text not null,
  fetched_at timestamptz not null default now(),
  menu_rows int not null,
  ingredient_rows int not null,
  unmatched_menu_rows int not null,
  cogs_sum numeric not null,
  primary key (sales_date, branch_code)
);

create index esb_cogs_ingredient_lines_menu_idx on esb_cogs_ingredient_lines (sales_date, branch_code, menu_id);

alter table esb_cogs_menu_lines enable row level security;
alter table esb_cogs_ingredient_lines enable row level security;
alter table esb_cogs_menu_daily enable row level security;
alter table esb_cogs_fetch_log enable row level security;
revoke all on esb_cogs_menu_lines, esb_cogs_ingredient_lines, esb_cogs_menu_daily, esb_cogs_fetch_log
  from anon, authenticated;

-- First day of the current month in WIB: dates before it are "closed".
create or replace function fn_cogs_closed_before()
returns date
language sql
stable
as $$ select date_trunc('month', (now() at time zone 'Asia/Jakarta'))::date $$;

-- ---------------------------------------------------------------------------
-- Atomic publish of one (date, branch) partition. Replaces the partition in
-- one transaction (so a failed fetch never leaves it half-written) and
-- serialises with any concurrent run via an advisory lock per partition.
-- ---------------------------------------------------------------------------
create or replace function fn_esb_cogs_publish(
  p_sales_date date,
  p_branch_code text,
  p_menu_rows jsonb,
  p_ingredient_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_menu int;
  v_ingr int;
  v_unmatched int;
  v_cogs numeric;
begin
  perform pg_advisory_xact_lock(hashtext('sync-esb-cogs|' || p_sales_date || '|' || p_branch_code));

  if jsonb_typeof(p_menu_rows) <> 'array' or jsonb_typeof(p_ingredient_rows) <> 'array' then
    raise exception 'fn_esb_cogs_publish: rows must be JSON arrays';
  end if;

  delete from esb_cogs_menu_lines where sales_date = p_sales_date and branch_code = p_branch_code;
  delete from esb_cogs_ingredient_lines where sales_date = p_sales_date and branch_code = p_branch_code;
  delete from esb_cogs_menu_daily where sales_date = p_sales_date and branch_code = p_branch_code;

  -- menu_code -> menu_id from our own lines of the same partition (exact by
  -- sales_num + menu_code first, then by menu_code alone).
  insert into esb_cogs_menu_lines (
    sales_date, branch_code, seq, sales_num, menu_code, menu_name, menu_id, row_type,
    qty, price, total, discount_total, cogs_total, sales_type
  )
  select
    p_sales_date, p_branch_code, x.ord::int, x.r->>'salesNum', x.r->>'menuCode', x.r->>'menuName',
    coalesce(
      (select m.menu_id from raw_sales_menu_items m
        where m.sales_date = p_sales_date and m.branch_code = p_branch_code
          and m.sales_num = x.r->>'salesNum' and m.menu_code = x.r->>'menuCode' limit 1),
      (select m.menu_id from raw_sales_menu_items m
        where m.sales_date = p_sales_date and m.branch_code = p_branch_code
          and m.menu_code = x.r->>'menuCode' limit 1)
    ),
    x.r->>'rowType',
    (x.r->>'qty')::numeric, (x.r->>'price')::numeric, (x.r->>'total')::numeric,
    (x.r->>'discountTotal')::numeric, (x.r->>'cogsTotal')::numeric, x.r->>'salesType'
  from jsonb_array_elements(p_menu_rows) with ordinality as x(r, ord);
  get diagnostics v_menu = row_count;

  insert into esb_cogs_ingredient_lines (
    sales_date, branch_code, seq, menu_name, menu_id, product_name, category_name, sub_category_name,
    uom_name, qty_total, value_total, sales_type
  )
  select
    p_sales_date, p_branch_code, x.ord::int, x.r->>'menuName',
    coalesce(
      (select l.menu_id from esb_cogs_menu_lines l
        where l.sales_date = p_sales_date and l.branch_code = p_branch_code
          and l.menu_name = x.r->>'menuName' and l.menu_id is not null limit 1),
      (select m.menu_id from raw_sales_menu_items m
        where m.sales_date = p_sales_date and m.branch_code = p_branch_code
          and m.menu_name = x.r->>'menuName' limit 1)
    ),
    x.r->>'productName', x.r->>'categoryName', x.r->>'subCategoryName', x.r->>'uomName',
    (x.r->>'qtyTotal')::numeric, (x.r->>'valueTotal')::numeric, x.r->>'salesTypeHead'
  from jsonb_array_elements(p_ingredient_rows) with ordinality as x(r, ord);
  get diagnostics v_ingr = row_count;

  insert into esb_cogs_menu_daily (
    sales_date, branch_code, menu_id, qty, cogs, ingredient_rows, invalid_ingredient_rows, is_package
  )
  select
    p_sales_date, p_branch_code, l.menu_id,
    coalesce(sum(l.qty), 0),
    coalesce(sum(l.cogs_total), 0),
    coalesce(max(i.n), 0),
    coalesce(max(i.invalid), 0),
    bool_or(coalesce(l.row_type, 'ALACARTE') <> 'ALACARTE')
  from esb_cogs_menu_lines l
  left join lateral (
    select count(*)::int as n, count(*) filter (where coalesce(il.value_total, 0) <= 0)::int as invalid
    from esb_cogs_ingredient_lines il
    where il.sales_date = p_sales_date and il.branch_code = p_branch_code and il.menu_id = l.menu_id
  ) i on true
  where l.sales_date = p_sales_date and l.branch_code = p_branch_code and l.menu_id is not null
  group by l.menu_id;

  select count(*) filter (where menu_id is null), coalesce(sum(cogs_total), 0)
  into v_unmatched, v_cogs
  from esb_cogs_menu_lines
  where sales_date = p_sales_date and branch_code = p_branch_code;

  insert into esb_cogs_fetch_log (sales_date, branch_code, fetched_at, menu_rows, ingredient_rows, unmatched_menu_rows, cogs_sum)
  values (p_sales_date, p_branch_code, now(), v_menu, v_ingr, v_unmatched, v_cogs)
  on conflict (sales_date, branch_code) do update set
    fetched_at = excluded.fetched_at,
    menu_rows = excluded.menu_rows,
    ingredient_rows = excluded.ingredient_rows,
    unmatched_menu_rows = excluded.unmatched_menu_rows,
    cogs_sum = excluded.cogs_sum;

  return jsonb_build_object('menu_rows', v_menu, 'ingredient_rows', v_ingr, 'unmatched_menu_rows', v_unmatched, 'cogs_sum', v_cogs);
end;
$$;

revoke execute on function fn_esb_cogs_publish(date, text, jsonb, jsonb) from public, anon, authenticated;

-- (date, branch) partitions that have sales in a range, with their last
-- fetch time -- the sync's work list. PostgREST can't do DISTINCT itself.
create or replace function fn_esb_cogs_partitions(p_from date, p_to date)
returns table (sales_date date, branch_code text, fetched_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.sales_date, p.branch_code, f.fetched_at
  from (
    select distinct m.sales_date, m.branch_code
    from raw_sales_menu_items m
    where m.sales_date between p_from and p_to
  ) p
  left join esb_cogs_fetch_log f on f.sales_date = p.sales_date and f.branch_code = p.branch_code
  order by p.sales_date, p.branch_code
$$;

revoke execute on function fn_esb_cogs_partitions(date, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Read side. fn_hpp_sales_asof now works per (day, branch, menu) and picks
-- the source per day: ESB actual for closed months, BOM snapshot estimate for
-- the current month. Return shape changes, so drop + recreate it and the
-- functions whose output changes.
-- ---------------------------------------------------------------------------
drop function if exists fn_menu_hpp(date, date, text, text, text);
drop function if exists fn_hpp_sales_asof(date, date, text, text, text);

create function fn_hpp_sales_asof(
  p_date_start date,
  p_date_end date,
  p_outlet text,
  p_category_id text,
  p_category_detail_id text
)
returns table (
  sales_date date,
  branch_code text,
  menu_id text,
  menu_key bigint,
  menu_name text,
  category text,
  category_detail text,
  qty numeric,
  revenue numeric,
  source text,          -- 'esb' (closed month) | 'bom' (current month)
  snapshot_date date,   -- BOM snapshot used (bom source only)
  bom_id bigint,        -- BOM used (bom source only)
  hpp numeric,          -- BOM unit HPP (bom source only)
  cogs numeric,         -- costed amount; null when the day isn't costed
  day_status text,
  has_usage boolean     -- ingredient usage can be derived for this row
)
language sql
stable
security definer
set search_path = public
as $$
  with sales as (
    select
      v.sales_date,
      v.branch_code,
      v.menu_id,
      case when v.menu_id ~ '^[0-9]+$' then v.menu_id::bigint end as menu_key,
      max(v.menu_name) as menu_name,
      max(v.category) as category,
      max(v.category_detail) as category_detail,
      sum(v.qty)::numeric as qty,
      sum(v.revenue)::numeric as revenue,
      case when v.sales_date < fn_cogs_closed_before() then 'esb' else 'bom' end as source
    from v_sales_product_daily v
    where v.sales_date between p_date_start and p_date_end
      and (p_outlet is null or v.branch_code = p_outlet)
      and (p_category_id is null or v.category_id = p_category_id)
      and (p_category_detail_id is null or v.category_detail_id = p_category_detail_id)
    group by v.sales_date, v.branch_code, v.menu_id
  )
  select
    s.sales_date, s.branch_code, s.menu_id, s.menu_key, s.menu_name, s.category, s.category_detail,
    s.qty, s.revenue, s.source,
    snap.snapshot_date, snap.bom_id, snap.hpp,
    case
      when s.source = 'esb' then case when e.status = 'ok' then e.cogs end
      when snap.cost_status = 'ok' then s.qty * snap.hpp
    end as cogs,
    case
      when s.source = 'esb' then e.status
      when snap.snapshot_date is not null then snap.cost_status
      when not exists (select 1 from esb_menus em where em.menu_id = s.menu_key) then 'unmapped'
      else 'no_historical_cost'
    end as day_status,
    case
      when s.source = 'esb' then coalesce(e.ingredient_rows, 0) > 0
      else snap.bom_id is not null
    end as has_usage
  from sales s
  left join lateral (
    select h.snapshot_date, h.bom_id, h.hpp, h.cost_status
    from menu_hpp_snapshots h
    where s.source = 'bom'
      and h.menu_id = s.menu_key
      and h.snapshot_date <= s.sales_date
    order by h.snapshot_date desc
    limit 1
  ) snap on true
  left join lateral (
    select
      d.cogs,
      d.ingredient_rows,
      case
        when not exists (
          select 1 from esb_cogs_fetch_log f where f.sales_date = s.sales_date and f.branch_code = s.branch_code
        ) then 'esb_pending'
        when d.menu_id is null then 'unmapped'
        when d.is_package then 'package'
        when d.ingredient_rows = 0 then 'no_bom'
        when d.invalid_ingredient_rows > 0 or d.cogs <= 0 then 'incomplete_cost'
        else 'ok'
      end as status
    from (select 1) one
    left join esb_cogs_menu_daily d
      on d.sales_date = s.sales_date and d.branch_code = s.branch_code and d.menu_id = s.menu_id
    where s.source = 'esb'
  ) e on true
$$;

revoke execute on function fn_hpp_sales_asof(date, date, text, text, text) from public, anon, authenticated;

create function fn_menu_hpp(
  p_date_start date,
  p_date_end date,
  p_outlet text default null,
  p_category_id text default null,
  p_category_detail_id text default null
)
returns table (
  menu_id text,
  menu_name text,
  category text,
  category_detail text,
  qty numeric,
  revenue numeric,
  avg_selling_price numeric,
  latest_hpp numeric,
  latest_snapshot_date date,
  latest_cost_status text,
  cogs numeric,             -- cogs_actual + cogs_estimate
  cogs_actual numeric,      -- ESB actual (closed months)
  cogs_estimate numeric,    -- BOM snapshot estimate (current month)
  costed_qty numeric,
  uncosted_qty numeric,
  cost_coverage_status text
)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select * from fn_hpp_sales_asof(p_date_start, p_date_end, p_outlet, p_category_id, p_category_detail_id)
  ),
  per_menu as (
    select
      d.menu_id,
      max(d.menu_key) as menu_key,
      max(d.menu_name) as menu_name,
      max(d.category) as category,
      max(d.category_detail) as category_detail,
      sum(d.qty) as qty,
      sum(d.revenue) as revenue,
      coalesce(sum(d.cogs) filter (where d.source = 'esb'), 0) as cogs_actual,
      coalesce(sum(d.cogs) filter (where d.source = 'bom'), 0) as cogs_estimate,
      coalesce(sum(d.qty) filter (where d.cogs is not null), 0) as costed_qty,
      coalesce(sum(d.qty) filter (where d.cogs is null), 0) as uncosted_qty,
      (array_agg(d.day_status order by d.qty desc) filter (where d.cogs is null))[1] as worst_status
    from days d
    group by d.menu_id
  )
  select
    p.menu_id,
    p.menu_name,
    p.category,
    p.category_detail,
    p.qty,
    p.revenue,
    p.revenue / nullif(p.qty, 0),
    latest.hpp,
    latest.snapshot_date,
    latest.cost_status,
    p.cogs_actual + p.cogs_estimate,
    p.cogs_actual,
    p.cogs_estimate,
    p.costed_qty,
    p.uncosted_qty,
    case when p.uncosted_qty = 0 and p.costed_qty > 0 then 'complete' else coalesce(p.worst_status, 'no_historical_cost') end
  from per_menu p
  left join lateral (
    select h.hpp, h.snapshot_date, h.cost_status
    from menu_hpp_snapshots h
    where h.menu_id = p.menu_key
      and h.snapshot_date <= p_date_end
    order by h.snapshot_date desc
    limit 1
  ) latest on true
  order by p.revenue desc nulls last
$$;

-- Ingredient usage: ESB recap rows for closed months (actual qty/cost), BOM
-- lines for the current month. Grouped by (ingredient name, UOM) because the
-- ESB report carries no product id. product_id is filled only when every row
-- of the group comes from the BOM side with a single id.
create or replace function fn_ingredient_usage(
  p_date_start date,
  p_date_end date,
  p_outlet text default null,
  p_category_id text default null,
  p_category_detail_id text default null
)
returns table (
  product_id bigint,
  product_code text,
  product_name text,
  uom_name text,
  total_usage_qty numeric,
  menu_count int,
  est_cost numeric,
  uncosted_usage_qty numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select * from fn_hpp_sales_asof(p_date_start, p_date_end, p_outlet, p_category_id, p_category_detail_id)
  ),
  usage as (
    -- closed months: ESB actuals, scoped to the filtered (date, branch, menu) set
    select
      null::bigint as product_id,
      null::text as product_code,
      i.product_name,
      i.uom_name,
      d.menu_id,
      i.qty_total as usage_qty,
      case when i.value_total > 0 then i.value_total end as cost
    from days d
    join esb_cogs_ingredient_lines i
      on i.sales_date = d.sales_date and i.branch_code = d.branch_code and i.menu_id = d.menu_id
    where d.source = 'esb'
    union all
    -- current month: qty sold x BOM qty from the snapshot in force that day
    select
      l.product_id,
      l.product_code,
      l.product_name,
      l.uom_name,
      d.menu_id,
      d.qty * l.qty,
      d.qty * fn_hpp_line_cost(l.qty, l.convertion_qty, l.yield_percent, l.last_hpp)
    from days d
    join esb_bom_lines l on l.snapshot_date = d.snapshot_date and l.bom_id = d.bom_id
    where d.source = 'bom'
  )
  select
    case when count(distinct u.product_id) = 1 and bool_and(u.product_id is not null) then max(u.product_id) end,
    max(u.product_code),
    max(u.product_name),
    u.uom_name,
    sum(u.usage_qty),
    count(distinct u.menu_id)::int,
    coalesce(sum(u.cost), 0),
    coalesce(sum(u.usage_qty) filter (where u.cost is null), 0)
  from usage u
  group by lower(u.product_name), u.uom_name
  order by sum(u.usage_qty) desc
$$;

create or replace function fn_ingredient_usage_coverage(
  p_date_start date,
  p_date_end date,
  p_outlet text default null,
  p_category_id text default null,
  p_category_detail_id text default null
)
returns table (menu_qty_total numeric, menu_qty_counted numeric, menu_qty_not_counted numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(d.qty), 0),
    coalesce(sum(d.qty) filter (where d.has_usage), 0),
    coalesce(sum(d.qty) filter (where not d.has_usage), 0)
  from fn_hpp_sales_asof(p_date_start, p_date_end, p_outlet, p_category_id, p_category_detail_id) d
$$;

revoke execute on function fn_menu_hpp(date, date, text, text, text) from public, anon;
grant execute on function fn_menu_hpp(date, date, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cron: daily auto mode re-fetches closed-month partitions until ESB's
-- closing window passes (see the Edge Function). 21:00 UTC = 04:00 WIB.
-- ---------------------------------------------------------------------------
create or replace function fn_sync_esb_cogs_dispatch()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, net, vault
as $$
declare
  v_secret text;
  v_request_id bigint;
  v_body jsonb := jsonb_build_object('trigger', 'cron', 'mode', 'auto');
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'sync_esb_shared_secret';

  if v_secret is null or length(v_secret) = 0 then
    raise exception
      'vault secret "sync_esb_shared_secret" is missing or empty -- sync-esb-cogs cannot authenticate';
  end if;

  select net.http_post(
    url := 'https://giyspsmyitlygujelqjd.supabase.co/functions/v1/sync-esb-cogs',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', v_secret),
    body := v_body,
    timeout_milliseconds := 300000
  ) into v_request_id;

  insert into sync_dispatch (kind, request_id, payload)
  values ('cogs', v_request_id, v_body);

  return v_request_id;
end;
$$;

revoke execute on function fn_sync_esb_cogs_dispatch() from public, anon, authenticated;

do $$
declare
  v_jobid bigint;
begin
  for v_jobid in select jobid from cron.job where jobname = 'sync-esb-cogs-daily'
  loop
    perform cron.unschedule(v_jobid);
  end loop;
end;
$$;

select cron.schedule(
  'sync-esb-cogs-daily',
  '0 21 * * *',
  $$ select public.fn_sync_esb_cogs_dispatch(); $$
);
