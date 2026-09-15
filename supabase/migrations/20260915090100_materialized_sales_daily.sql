-- Materialize the single most-queried aggregate (v_sales_daily_outlet --
-- every KPI on Overview and Sales, plus fn_promo_performance's baseline, and
-- the new outlet leaderboard panel all read it) so it stops being recomputed
-- from raw_sales on every dashboard request. At today's data volume this is
-- pure headroom, not a fix for an observed slowdown -- it's here so the
-- query pattern doesn't have to change later when volume does. The same
-- create-matview-then-wrap-in-a-view shape can be repeated for the other
-- daily-grain views (v_sales_product_daily, v_sales_ops_daily, etc.) if/when
-- they earn it; only this one was worth it today.
--
-- `v_sales_daily_outlet` keeps its name and column list (`create or replace
-- view`, so existing grants survive -- see the migration-gotcha note in
-- PROGRESS.md) and becomes a thin wrapper over the matview underneath, so
-- nothing that already queries it (the frontend via PostgREST,
-- fn_promo_performance) needs to change.
--
-- Refresh is plain `REFRESH MATERIALIZED VIEW` (not CONCURRENTLY): the
-- CONCURRENTLY form cannot run inside a transaction block, which rules out
-- calling it from a plpgsql function (fn_sync_esb_reconcile, or an RPC call)
-- at all -- it would need a top-level CALL to a PROCEDURE outside any
-- transaction. A plain refresh takes a brief ACCESS EXCLUSIVE lock on the
-- matview, which is a non-issue at current row counts (hundreds/day); revisit
-- with CONCURRENTLY + a unique index once a refresh is slow enough to notice.
create materialized view mv_sales_daily_outlet as
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
    subtotal
    - other_tax_total - vat_total - other_vat_total
    - discount_total
    - rounding_total
  ) filter (where status_name = 'Finished') as nett_sales
from raw_sales
group by sales_date, branch_code
with data;

create index mv_sales_daily_outlet_date_branch_idx on mv_sales_daily_outlet (sales_date, branch_code);

revoke all on mv_sales_daily_outlet from anon, authenticated;

create or replace view v_sales_daily_outlet as
select sales_date, branch_code, revenue, trans_count, member_revenue, non_promo_revenue, non_promo_trans_count, nett_sales
from mv_sales_daily_outlet;

create or replace function fn_refresh_sales_analytics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view mv_sales_daily_outlet;
end;
$$;

grant execute on function fn_refresh_sales_analytics() to service_role;

-- Belt-and-suspenders: if the Edge Function's post-sync refresh call
-- (supabase/functions/sync-esb/refresh-analytics.ts) ever fails silently,
-- the 10-minute reconcile job self-heals the matview without anyone noticing
-- a gap. Redefines the same function again (see 20260915090000_sync_alerting.sql)
-- since `create or replace function` replaces the whole body, not a diff.
create or replace function fn_sync_esb_reconcile()
returns int
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_updated int;
begin
  with updated as (
    update sync_dispatch d
    set status_code = coalesce(r.status_code, 0),
        response = jsonb_strip_nulls(jsonb_build_object(
          'body', left(r.content, 2000),
          'error', r.error_msg
        )),
        checked_at = now()
    from net._http_response r
    where r.id = d.request_id
      and d.status_code is null
    returning 1
  )
  select count(*) into v_updated from updated;

  update sync_dispatch
  set status_code = -1,
      response = jsonb_build_object('error', 'pg_net response was pruned before reconcile ran'),
      checked_at = now()
  where status_code is null
    and dispatched_at < now() - interval '6 hours';

  perform fn_sync_esb_alert();
  perform fn_refresh_sales_analytics();

  return v_updated;
end;
$$;
