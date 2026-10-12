-- HPP (cost of goods) per menu, from ESB Master Menu (get-menu) + ESB Core
-- BOM detail, written by the sync-esb-hpp Edge Function.
--
-- Three layers:
--   esb_menus           current menu master (mapping menu -> BOM *today*)
--   esb_bom_lines       raw BOM lines per snapshot day -- the source of truth
--                       for every cost figure, so the HPP formula can be
--                       corrected later and recomputed WITHOUT refetching ESB
--   menu_hpp_snapshots  computed HPP per (snapshot day, menu), including the
--                       BOM the menu pointed to on that day -- historical
--                       COGS never changes when a menu is re-mapped later
--
-- Historical costing is strict as-of: a sale on day D uses the latest
-- snapshot with snapshot_date <= D, never a later one. Sales before the first
-- snapshot are reported as `no_historical_cost`, not costed with today's HPP.
--
-- All cost math is NUMERIC with no scale and no rounding before aggregation;
-- rounding only happens in the UI.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table esb_menus (
  menu_id bigint primary key,
  menu_code text,
  menu_name text,
  bom_id bigint,                 -- null when ESB returns bomID = 0 (no BOM)
  bom_name text,
  category_detail text,
  flag_active smallint,
  is_package boolean not null default false,
  synced_at timestamptz not null default now()
);

create table esb_bom_lines (
  snapshot_date date not null,
  bom_id bigint not null,
  line_id bigint not null,
  product_id bigint,
  product_code text,
  product_name text,
  qty numeric,
  uom_name text,
  convertion_qty numeric,
  yield_percent numeric,
  tolerance_percent numeric,
  weight_factor numeric,
  last_hpp numeric,
  -- Raw `subtitution` array (productNameDetail, productNameSubtitution, ...).
  -- Informational only; never part of the cost or usage math.
  substitutions jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  primary key (snapshot_date, bom_id, line_id)
);

create index esb_bom_lines_bom_date_idx on esb_bom_lines (bom_id, snapshot_date desc);

create table menu_hpp_snapshots (
  snapshot_date date not null,
  menu_id bigint not null,
  bom_id bigint,
  hpp numeric,
  costed_line_count int not null default 0,
  invalid_line_count int not null default 0,
  cost_status text not null check (cost_status in ('ok', 'incomplete_cost', 'no_bom', 'package')),
  formula_version smallint not null,
  computed_at timestamptz not null default now(),
  primary key (snapshot_date, menu_id)
);

create index menu_hpp_snapshots_menu_date_idx on menu_hpp_snapshots (menu_id, snapshot_date desc);

alter table esb_menus enable row level security;
alter table esb_bom_lines enable row level security;
alter table menu_hpp_snapshots enable row level security;

revoke all on esb_menus, esb_bom_lines, menu_hpp_snapshots from anon, authenticated;

-- ---------------------------------------------------------------------------
-- sync_log: allow 'partial_success' (some BOMs failed, the rest published).
-- Additive -- existing rows and the sync-esb job are unaffected.
-- ---------------------------------------------------------------------------
alter table sync_log drop constraint if exists sync_log_status_check;
alter table sync_log
  add constraint sync_log_status_check
  check (status in ('running', 'success', 'partial_success', 'failed'));

-- The header's "Data terakhir diperbarui" means the SALES data. Without this
-- filter a successful HPP sync would show up there as the last sales sync.
-- Same columns as before, so `create or replace` is safe.
create or replace view v_last_sync as
select job_name, finished_at, status, rows_synced
from sync_log
where status = 'success'
  and job_name = 'sync-esb'
order by finished_at desc
limit 1;

-- ---------------------------------------------------------------------------
-- HPP formula. The ONLY place cost-per-line is defined.
--
-- PROVISIONAL (formula_version 1) -- not yet validated against ESB's own HPP
-- figures (plan blocker B2). Assumes `last_hpp` is per base unit and
-- `convertion_qty` converts the line's UOM to that base unit; ignores
-- yield_percent / tolerance_percent / weight_factor. A line is only costed
-- when every input is present and positive: a 0/null last_hpp is a missing
-- cost, never a free ingredient.
--
-- To correct it: ship a migration that replaces this function, bumps
-- fn_hpp_formula_version(), and recomputes menu_hpp_snapshots from
-- esb_bom_lines with fn_hpp_snapshot_cost().
-- ---------------------------------------------------------------------------
create or replace function fn_hpp_formula_version()
returns smallint
language sql
immutable
as $$ select 1::smallint $$;

create or replace function fn_hpp_line_cost(
  p_qty numeric,
  p_convertion_qty numeric,
  p_yield_percent numeric,
  p_last_hpp numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_qty > 0 and p_convertion_qty > 0 and p_last_hpp > 0
      then p_qty * p_convertion_qty * p_last_hpp
    else null
  end
$$;

-- HPP of one BOM as stored for one snapshot day.
create or replace function fn_hpp_snapshot_cost(p_snapshot_date date, p_bom_id bigint)
returns table (hpp numeric, costed_line_count int, invalid_line_count int)
language sql
stable
set search_path = public
as $$
  select
    sum(c.line_cost),
    count(c.line_cost)::int,
    (count(*) - count(c.line_cost))::int
  from (
    select fn_hpp_line_cost(l.qty, l.convertion_qty, l.yield_percent, l.last_hpp) as line_cost
    from esb_bom_lines l
    where l.snapshot_date = p_snapshot_date
      and l.bom_id = p_bom_id
  ) c
$$;

revoke execute on function fn_hpp_snapshot_cost(date, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Atomic publish, called once per run by the sync-esb-hpp Edge Function
-- (PostgREST can't span a transaction across calls, so the whole publish is
-- one RPC = one transaction).
--
-- p_menus     [{menu_id, menu_code, menu_name, bom_id, bom_name,
--               category_detail, flag_active, is_package}]   -- every menu
-- p_bom_lines [{bom_id, line_id, product_id, ..., substitutions}]
--             -- lines of SUCCESSFULLY fetched BOMs only
--
-- * Serialised by an advisory lock, so a cron run and a manual run can't
--   interleave their writes.
-- * BOMs that failed to fetch are simply absent from p_bom_lines: their lines
--   and their menus' snapshots are left untouched, so an earlier valid
--   snapshot is never overwritten by a failed fetch.
-- * Re-running the same day replaces that day's rows for the BOMs it fetched
--   (delete + insert inside this transaction), so a line removed in ESB
--   doesn't linger. Other days are never touched.
-- ---------------------------------------------------------------------------
create or replace function fn_hpp_publish(
  p_snapshot_date date,
  p_menus jsonb,
  p_bom_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_menus int;
  v_lines int;
  v_snapshots int;
begin
  perform pg_advisory_xact_lock(hashtext('sync-esb-hpp'));

  if p_menus is null or jsonb_typeof(p_menus) <> 'array' or jsonb_array_length(p_menus) = 0 then
    raise exception 'fn_hpp_publish: p_menus is empty -- refusing to publish';
  end if;
  if p_bom_lines is null or jsonb_typeof(p_bom_lines) <> 'array' then
    raise exception 'fn_hpp_publish: p_bom_lines must be a JSON array';
  end if;

  insert into esb_menus as m (
    menu_id, menu_code, menu_name, bom_id, bom_name, category_detail, flag_active, is_package, synced_at
  )
  select menu_id, menu_code, menu_name, bom_id, bom_name, category_detail, flag_active, coalesce(is_package, false), now()
  from jsonb_to_recordset(p_menus) as x(
    menu_id bigint, menu_code text, menu_name text, bom_id bigint, bom_name text,
    category_detail text, flag_active smallint, is_package boolean
  )
  on conflict (menu_id) do update set
    menu_code = excluded.menu_code,
    menu_name = excluded.menu_name,
    bom_id = excluded.bom_id,
    bom_name = excluded.bom_name,
    category_detail = excluded.category_detail,
    flag_active = excluded.flag_active,
    is_package = excluded.is_package,
    synced_at = excluded.synced_at;
  get diagnostics v_menus = row_count;

  create temp table _hpp_lines on commit drop as
  select *
  from jsonb_to_recordset(p_bom_lines) as x(
    bom_id bigint, line_id bigint, product_id bigint, product_code text, product_name text,
    qty numeric, uom_name text, convertion_qty numeric, yield_percent numeric,
    tolerance_percent numeric, weight_factor numeric, last_hpp numeric, substitutions jsonb
  );

  delete from esb_bom_lines l
  where l.snapshot_date = p_snapshot_date
    and l.bom_id in (select distinct bom_id from _hpp_lines);

  insert into esb_bom_lines (
    snapshot_date, bom_id, line_id, product_id, product_code, product_name, qty, uom_name,
    convertion_qty, yield_percent, tolerance_percent, weight_factor, last_hpp, substitutions, fetched_at
  )
  select
    p_snapshot_date, bom_id, line_id, product_id, product_code, product_name, qty, uom_name,
    convertion_qty, yield_percent, tolerance_percent, weight_factor, last_hpp,
    coalesce(substitutions, '[]'::jsonb), now()
  from _hpp_lines;
  get diagnostics v_lines = row_count;

  insert into menu_hpp_snapshots as s (
    snapshot_date, menu_id, bom_id, hpp, costed_line_count, invalid_line_count,
    cost_status, formula_version, computed_at
  )
  select
    p_snapshot_date,
    m.menu_id,
    m.bom_id,
    case when m.bom_id is null then null else c.hpp end,
    coalesce(c.costed_line_count, 0),
    coalesce(c.invalid_line_count, 0),
    case
      when m.bom_id is null and m.is_package then 'package'
      when m.bom_id is null then 'no_bom'
      when c.invalid_line_count = 0 and c.costed_line_count > 0 then 'ok'
      else 'incomplete_cost'
    end,
    fn_hpp_formula_version(),
    now()
  from jsonb_to_recordset(p_menus) as m(menu_id bigint, bom_id bigint, is_package boolean)
  left join lateral fn_hpp_snapshot_cost(p_snapshot_date, m.bom_id) c on m.bom_id is not null
  -- Menus whose BOM failed to fetch this run are skipped: no row for today,
  -- so as-of lookups keep using their last valid snapshot.
  where m.bom_id is null
     or m.bom_id in (select distinct bom_id from _hpp_lines)
  on conflict (snapshot_date, menu_id) do update set
    bom_id = excluded.bom_id,
    hpp = excluded.hpp,
    costed_line_count = excluded.costed_line_count,
    invalid_line_count = excluded.invalid_line_count,
    cost_status = excluded.cost_status,
    formula_version = excluded.formula_version,
    computed_at = excluded.computed_at;
  get diagnostics v_snapshots = row_count;

  return jsonb_build_object('menus', v_menus, 'bom_lines', v_lines, 'snapshots', v_snapshots);
end;
$$;

revoke execute on function fn_hpp_publish(date, jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Read side. Internal helper: each (sales day, menu) row from
-- v_sales_product_daily with the snapshot in force on that day (strict
-- as-of) and a per-day costing status. Not granted to anyone -- only the
-- three RPCs below call it.
-- ---------------------------------------------------------------------------
create or replace function fn_hpp_sales_asof(
  p_date_start date,
  p_date_end date,
  p_outlet text,
  p_category_id text,
  p_category_detail_id text
)
returns table (
  sales_date date,
  menu_id text,
  menu_key bigint,
  menu_name text,
  category text,
  category_detail text,
  qty numeric,
  revenue numeric,
  snapshot_date date,
  bom_id bigint,
  hpp numeric,
  day_status text
)
language sql
stable
security definer
set search_path = public
as $$
  with sales as (
    select
      v.sales_date,
      v.menu_id,
      -- sales store menu_id as text; ESB's master menu uses an integer id.
      -- CASE (not a bare cast in the join) so a non-numeric id can never
      -- raise mid-query.
      case when v.menu_id ~ '^[0-9]+$' then v.menu_id::bigint end as menu_key,
      max(v.menu_name) as menu_name,
      max(v.category) as category,
      max(v.category_detail) as category_detail,
      sum(v.qty)::numeric as qty,
      sum(v.revenue)::numeric as revenue
    from v_sales_product_daily v
    where v.sales_date between p_date_start and p_date_end
      and (p_outlet is null or v.branch_code = p_outlet)
      and (p_category_id is null or v.category_id = p_category_id)
      and (p_category_detail_id is null or v.category_detail_id = p_category_detail_id)
    group by v.sales_date, v.menu_id
  )
  select
    s.sales_date, s.menu_id, s.menu_key, s.menu_name, s.category, s.category_detail,
    s.qty, s.revenue,
    snap.snapshot_date, snap.bom_id, snap.hpp,
    case
      when snap.snapshot_date is not null then snap.cost_status
      when not exists (select 1 from esb_menus em where em.menu_id = s.menu_key) then 'unmapped'
      else 'no_historical_cost'
    end as day_status
  from sales s
  left join lateral (
    select h.snapshot_date, h.bom_id, h.hpp, h.cost_status
    from menu_hpp_snapshots h
    where h.menu_id = s.menu_key
      and h.snapshot_date <= s.sales_date
    order by h.snapshot_date desc
    limit 1
  ) snap on true
$$;

revoke execute on function fn_hpp_sales_asof(date, date, text, text, text) from public, anon, authenticated;

-- HPP & historical COGS per menu for the filter bar's period/outlet/category.
-- food_cost_pct / gross_margin intentionally NOT returned until the revenue
-- basis of v_sales_product_daily is validated (plan blocker B3).
create or replace function fn_menu_hpp(
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
  cogs numeric,
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
      coalesce(sum(d.qty * d.hpp) filter (where d.day_status = 'ok'), 0) as cogs,
      coalesce(sum(d.qty) filter (where d.day_status = 'ok'), 0) as costed_qty,
      coalesce(sum(d.qty) filter (where d.day_status <> 'ok'), 0) as uncosted_qty,
      -- Dominant reason (by qty) when not every unit sold could be costed.
      (array_agg(d.day_status order by d.qty desc) filter (where d.day_status <> 'ok'))[1] as worst_status
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
    p.cogs,
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

-- BOM lines in force for one menu as of a date (the panel's expandable row).
-- Empty when no snapshot exists on/before p_as_of or the menu has no BOM.
create or replace function fn_menu_bom_detail(p_menu_id text, p_as_of date)
returns table (
  snapshot_date date,
  bom_id bigint,
  line_id bigint,
  product_id bigint,
  product_code text,
  product_name text,
  qty numeric,
  uom_name text,
  convertion_qty numeric,
  yield_percent numeric,
  last_hpp numeric,
  line_cost numeric,
  is_valid boolean,
  substitutions jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with snap as (
    select h.snapshot_date, h.bom_id
    from menu_hpp_snapshots h
    where h.menu_id = case when p_menu_id ~ '^[0-9]+$' then p_menu_id::bigint end
      and h.snapshot_date <= p_as_of
    order by h.snapshot_date desc
    limit 1
  )
  select
    l.snapshot_date, l.bom_id, l.line_id, l.product_id, l.product_code, l.product_name,
    l.qty, l.uom_name, l.convertion_qty, l.yield_percent, l.last_hpp,
    fn_hpp_line_cost(l.qty, l.convertion_qty, l.yield_percent, l.last_hpp),
    fn_hpp_line_cost(l.qty, l.convertion_qty, l.yield_percent, l.last_hpp) is not null,
    l.substitutions
  from snap
  join esb_bom_lines l on l.snapshot_date = snap.snapshot_date and l.bom_id = snap.bom_id
  order by l.line_id
$$;

-- Theoretical ingredient usage = qty sold x BOM line qty, using the BOM in
-- force on each sales day. Grouped per (product, UOM) because the API gives
-- no base-unit name to safely convert across UOMs (plan blocker B6).
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
  select
    l.product_id,
    max(l.product_code),
    max(l.product_name),
    l.uom_name,
    sum(d.qty * l.qty),
    count(distinct d.menu_id)::int,
    coalesce(sum(d.qty * fn_hpp_line_cost(l.qty, l.convertion_qty, l.yield_percent, l.last_hpp)), 0),
    coalesce(sum(d.qty * l.qty) filter (
      where fn_hpp_line_cost(l.qty, l.convertion_qty, l.yield_percent, l.last_hpp) is null
    ), 0)
  from fn_hpp_sales_asof(p_date_start, p_date_end, p_outlet, p_category_id, p_category_detail_id) d
  join esb_bom_lines l on l.snapshot_date = d.snapshot_date and l.bom_id = d.bom_id
  group by l.product_id, l.uom_name
  order by sum(d.qty * l.qty) desc
$$;

-- How much of the period's menu sales the usage table could NOT account for
-- (no snapshot yet, no BOM, package, or menu unknown to ESB master).
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
    coalesce(sum(d.qty) filter (where d.bom_id is not null), 0),
    coalesce(sum(d.qty) filter (where d.bom_id is null), 0)
  from fn_hpp_sales_asof(p_date_start, p_date_end, p_outlet, p_category_id, p_category_detail_id) d
$$;

revoke execute on function fn_menu_hpp(date, date, text, text, text) from public, anon;
revoke execute on function fn_menu_bom_detail(text, date) from public, anon;
revoke execute on function fn_ingredient_usage(date, date, text, text, text) from public, anon;
revoke execute on function fn_ingredient_usage_coverage(date, date, text, text, text) from public, anon;
grant execute on function fn_menu_hpp(date, date, text, text, text) to authenticated;
grant execute on function fn_menu_bom_detail(text, date) to authenticated;
grant execute on function fn_ingredient_usage(date, date, text, text, text) to authenticated;
grant execute on function fn_ingredient_usage_coverage(date, date, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cron: same dispatch/reconcile/alert path as sync-esb. fn_sync_esb_reconcile
-- and fn_sync_esb_alert already handle every sync_dispatch kind; the Edge
-- Function answers 207 on partial success, which the alert treats as a
-- failure-worthy non-200 on purpose.
-- ---------------------------------------------------------------------------
create or replace function fn_sync_esb_hpp_dispatch()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, net, vault
as $$
declare
  v_secret text;
  v_request_id bigint;
  v_body jsonb := jsonb_build_object('trigger', 'cron');
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'sync_esb_shared_secret';

  if v_secret is null or length(v_secret) = 0 then
    raise exception
      'vault secret "sync_esb_shared_secret" is missing or empty -- sync-esb-hpp cannot authenticate';
  end if;

  select net.http_post(
    url := 'https://giyspsmyitlygujelqjd.supabase.co/functions/v1/sync-esb-hpp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', v_secret
    ),
    body := v_body,
    timeout_milliseconds := 300000
  ) into v_request_id;

  insert into sync_dispatch (kind, request_id, payload)
  values ('hpp', v_request_id, v_body);

  return v_request_id;
end;
$$;

revoke execute on function fn_sync_esb_hpp_dispatch() from public, anon, authenticated;

do $$
declare
  v_jobid bigint;
begin
  for v_jobid in select jobid from cron.job where jobname = 'sync-esb-hpp-daily'
  loop
    perform cron.unschedule(v_jobid);
  end loop;
end;
$$;

-- 22:00 UTC = 05:00 WIB, an hour before the sales sync. HPP is master data,
-- so once a day is enough; the panel has a manual "Sync HPP" for admins.
select cron.schedule(
  'sync-esb-hpp-daily',
  '0 22 * * *',
  $$ select public.fn_sync_esb_hpp_dispatch(); $$
);
