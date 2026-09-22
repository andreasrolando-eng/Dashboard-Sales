-- Dedicated, least-privilege Postgres role for the local MCP analytics
-- server (see mcp-server/README.md). Connects directly over Postgres wire
-- protocol (session pooler or direct connection), not through PostgREST --
-- unlike every other role in this repo (anon/authenticated/service_role),
-- so it needs its own login role with its own explicit grants rather than
-- riding on Supabase Auth's JWT-role resolution.
--
-- Password is set separately via the Supabase SQL Editor, never in a
-- migration file: alter role mcp_analytics with password '...';
create role mcp_analytics with login;

grant usage on schema public to mcp_analytics;

-- Pure per-day/per-outlet/per-product/per-promo aggregate views -- verified
-- by reading each CREATE VIEW statement individually: none carry a
-- customer-identifying column (no member_name, no raw contact info
-- anywhere in this list).
grant select on
  v_sales_daily_outlet,
  v_outlets,
  v_sales_product_daily,
  v_categories,
  v_category_details,
  v_sales_ops_daily,
  v_sales_channel_daily,
  v_sales_payment_method_daily,
  v_promo_daily
to mcp_analytics;

-- Neither function is SECURITY DEFINER, but everything each one reads
-- internally (v_sales_product_daily; v_sales_daily_outlet + v_promo_daily --
-- confirmed by reading both function bodies) is already granted above, so
-- they work fine as invoker-rights calls under mcp_analytics.
grant execute on function
  fn_menu_performance(date, date, text, text, text, numeric),
  fn_promo_performance(date, date, text)
to mcp_analytics;

-- Membership data needs a narrower path: fn_top_members/fn_membership_summary
-- (also not SECURITY DEFINER) internally read v_members_dim, which carries a
-- real member_name column. Rather than grant mcp_analytics direct SELECT on
-- that view -- which would let the bare connection string read every
-- member's name, well beyond what any MCP tool exposes -- wrap both calls in
-- SECURITY DEFINER functions kept in their own mcp_private schema (not
-- public), with search_path locked to '' (empty) so every referenced object
-- must be fully schema-qualified. This is the standard hardening for
-- definer functions: a caller-influenceable search path is the classic way
-- one gets tricked into resolving the wrong object.
--
-- mcp_top_members additionally drops member_name from its result -- the
-- analytical use case never needs to identify a member by name, only to
-- analyze spending/visit patterns (data minimization on top of the
-- credential-level minimization above).
create schema if not exists mcp_private;

create or replace function mcp_private.mcp_top_members(
  p_date_start date,
  p_date_end date,
  p_outlet text default null,
  p_limit int default 8
)
returns table (
  member_code text,
  outlet_name text,
  tier text,
  visits bigint,
  spending numeric,
  favorite_menu text
)
language sql
stable
security definer
set search_path = ''
as $$
  select member_code, outlet_name, tier, visits, spending, favorite_menu
  from public.fn_top_members(p_date_start, p_date_end, p_outlet, p_limit);
$$;

-- fn_membership_summary's own output already has no PII columns -- this
-- wrapper exists purely to avoid granting mcp_analytics direct SELECT on
-- v_members_dim/v_member_visits_daily, i.e. to shrink what the bare
-- credential can read, not to filter output columns.
create or replace function mcp_private.mcp_membership_summary(
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
security definer
set search_path = ''
as $$
  select * from public.fn_membership_summary(p_date_start, p_date_end, p_outlet);
$$;

-- Defense in depth: SECURITY DEFINER functions aren't auto-granted to
-- PUBLIC by default in Postgres, but making "nobody but mcp_analytics"
-- explicit and independently verifiable is worth the extra lines rather
-- than relying on the default.
revoke all on function mcp_private.mcp_top_members(date, date, text, int) from public;
revoke all on function mcp_private.mcp_membership_summary(date, date, text) from public;
revoke execute on function mcp_private.mcp_top_members(date, date, text, int) from anon, authenticated;
revoke execute on function mcp_private.mcp_membership_summary(date, date, text) from anon, authenticated;

grant usage on schema mcp_private to mcp_analytics;
grant execute on function
  mcp_private.mcp_top_members(date, date, text, int),
  mcp_private.mcp_membership_summary(date, date, text)
to mcp_analytics;
