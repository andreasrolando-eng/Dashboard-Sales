-- Fixes a bug found while smoke-testing 20260922090000_mcp_analytics_role.sql
-- against real data: `set search_path = ''` on the mcp_private wrapper
-- functions doesn't just apply to their own (already schema-qualified) body
-- -- Postgres keeps that empty search_path in effect for the whole call,
-- including the un-qualified fn_top_members/fn_membership_summary bodies
-- they delegate to (neither has its own SET search_path clause). Those
-- functions' internal references to v_member_visits_daily/v_members_dim/
-- v_member_menu_daily then fail to resolve at all ("relation does not
-- exist"), since there's no schema left to search.
--
-- Fix: pin search_path to the fixed literal 'public' instead of empty.
-- This is still the standard-safe SECURITY DEFINER pattern -- the schema
-- list is set explicitly by the function definition itself, not inherited
-- from the calling session, so it can't be hijacked by a caller prepending
-- a malicious schema to their own search_path (the attack search_path=''
-- guards against in the first place). It just also has to be a schema that
-- actually contains what the delegated function needs to find, which ''
-- (empty) does not.
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
set search_path = public
as $$
  select member_code, outlet_name, tier, visits, spending, favorite_menu
  from public.fn_top_members(p_date_start, p_date_end, p_outlet, p_limit);
$$;

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
set search_path = public
as $$
  select * from public.fn_membership_summary(p_date_start, p_date_end, p_outlet);
$$;

-- create or replace function preserves existing grants on the same function
-- OID (unlike drop+recreate), so no re-grant/re-revoke needed here -- the
-- ones from 20260922090000_mcp_analytics_role.sql still apply.
