-- Access control: raw tables are written only by the service role (Edge
-- Function) and never queried directly by the app. The app reads only
-- through views/functions, which run as their postgres owner and therefore
-- bypass RLS on the underlying tables (standard Postgres view semantics) --
-- so granting SELECT/EXECUTE on those to `authenticated` is sufficient and
-- keeps raw tables fully locked down.

alter table outlets enable row level security;
alter table raw_sales enable row level security;
alter table raw_sales_payments enable row level security;
alter table raw_sales_menu_items enable row level security;
alter table raw_members enable row level security;
alter table sync_log enable row level security;

-- No policies are added for anon/authenticated on any raw table -- RLS with
-- zero policies means zero row access for those roles. service_role bypasses
-- RLS entirely (Supabase default), so the Edge Function's writes are
-- unaffected.

-- Defense in depth: Supabase grants broad default privileges on the public
-- schema to anon/authenticated at project bootstrap, so explicitly revoke
-- table-level access even though RLS already blocks it.
revoke all on outlets, raw_sales, raw_sales_payments, raw_sales_menu_items, raw_members, sync_log
  from anon, authenticated;

-- Narrow view for FR-20 (last synced at) instead of exposing sync_log
-- (which also carries error_message) wholesale.
create or replace view v_last_sync as
select job_name, finished_at, status, rows_synced
from sync_log
where status = 'success'
order by finished_at desc
limit 1;

grant usage on schema public to authenticated;

grant select on
  v_sales_daily_outlet,
  v_sales_hourly_outlet,
  v_sales_product_daily,
  v_promo_daily,
  v_outlets,
  v_categories,
  v_member_visits_daily,
  v_member_branch_counts,
  v_members_dim,
  v_membership_new_weekly,
  v_last_sync
to authenticated;

grant execute on function
  fn_menu_performance(date, date, text, text, numeric),
  fn_promo_performance(date, date, text),
  fn_membership_summary(date, date, text),
  fn_top_members(date, date, text, int)
to authenticated;
