-- Operational analytics views for the new "Operasional" tab: channel mix,
-- payment method mix, transaction status distribution, table dwell time,
-- revenue per cover, and discount type breakdown. All built from columns
-- that have been synced from ESB since day one but never surfaced anywhere
-- (raw_sales.visit_purpose_name/status_name/sales_date_in/out/pax_total,
-- raw_sales_payments.payment_method_type_name).
--
-- Field semantics were verified against the live project on 27 Aug 2026
-- (none of these columns are documented in the sync function -- they're
-- pure ESB pass-throughs) before writing these views:
--
-- - visitor_type_name is 0% populated project-wide -- not used anywhere.
-- - visit_purpose_name is 100% populated but the raw ESB values are messy:
--   "DINE IN", "Dine In (Inclusive)", "Dine In (Not Inclusive)" are three
--   separate strings for what is operationally the same channel. Normalized
--   below via CASE.
-- - status_name has a 4th value beyond New/Finished/Cancelled/Void that
--   nothing in this codebase documents: "New" was 46% of all rows in the
--   live sample, spread across the whole synced date range (not just recent
--   syncs) with real nonzero grand_total -- i.e. not empty carts. Since its
--   actual business meaning is unconfirmed, v_sales_ops_daily exposes raw
--   per-status counts without judging any of them "good" or "bad"; the UI
--   must not editorialize status_name = 'New' as a problem.

create or replace view v_sales_ops_daily as
select
  sales_date,
  branch_code,
  count(*) as trans_count_all,
  count(*) filter (where status_name = 'Finished') as trans_count_finished,
  count(*) filter (where status_name = 'Cancelled') as cancelled_count,
  count(*) filter (where status_name = 'Void') as void_count,
  count(*) filter (where status_name = 'New') as new_count,
  -- Dwell seconds capped at 8h (28800s) per bill before summing. A live
  -- sample on 27 Aug 2026 found bills with sales_date_out days after
  -- sales_date_in (max ~7 days) -- almost certainly a POS data glitch, not a
  -- real dine-in duration -- which would otherwise blow up the daily average.
  sum(least(extract(epoch from (sales_date_out - sales_date_in)), 28800))
    filter (
      where status_name = 'Finished'
        and sales_date_in is not null
        and sales_date_out is not null
        and sales_date_out >= sales_date_in
    ) as dwell_seconds_sum,
  count(*)
    filter (
      where status_name = 'Finished'
        and sales_date_in is not null
        and sales_date_out is not null
        and sales_date_out >= sales_date_in
    ) as dwell_sample_count,
  sum(pax_total) filter (where status_name = 'Finished' and pax_total is not null) as pax_total_sum,
  sum(menu_discount_total) filter (where status_name = 'Finished') as menu_discount_sum,
  sum(promotion_discount) filter (where status_name = 'Finished') as promotion_discount_sum,
  sum(voucher_discount_total) filter (where status_name = 'Finished') as voucher_discount_sum
from raw_sales
group by sales_date, branch_code;

create or replace view v_sales_channel_daily as
select
  sales_date,
  branch_code,
  case
    when visit_purpose_name ilike 'dine in%' then 'Dine In'
    when visit_purpose_name ilike '%pick up%' then 'Pick Up'
    when visit_purpose_name ilike '%delivery%' then 'Delivery'
    when visit_purpose_name is null then 'Tidak Diketahui'
    else visit_purpose_name
  end as channel,
  sum(grand_total) as revenue,
  count(*) as trans_count
from raw_sales
where status_name = 'Finished'
group by
  sales_date,
  branch_code,
  case
    when visit_purpose_name ilike 'dine in%' then 'Dine In'
    when visit_purpose_name ilike '%pick up%' then 'Pick Up'
    when visit_purpose_name ilike '%delivery%' then 'Delivery'
    when visit_purpose_name is null then 'Tidak Diketahui'
    else visit_purpose_name
  end;

create or replace view v_sales_payment_method_daily as
select
  s.sales_date,
  s.branch_code,
  p.payment_method_type_name,
  sum(p.payment_amount) as payment_amount,
  count(*) as payment_count
from raw_sales_payments p
join raw_sales s on s.sales_num = p.sales_num
where s.status_name = 'Finished'
group by s.sales_date, s.branch_code, p.payment_method_type_name;

grant select on v_sales_ops_daily, v_sales_channel_daily, v_sales_payment_method_daily to authenticated;
