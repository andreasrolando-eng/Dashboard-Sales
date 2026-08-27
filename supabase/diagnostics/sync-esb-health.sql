-- Paste into the Supabase SQL editor to answer "is the ESB sync actually
-- running?". Read-only.
--
-- Read it in this order -- the first two blocks are the ones that lied during
-- the 13-19 Aug and 21 Aug 2026 outages, and knowing WHY they lied is the
-- whole point of this file.

-- 1. What is scheduled right now.
--    After 20260827090000_cron_hardening.sql there should be exactly three
--    jobs: sync-esb-daily, sync-esb-catchup, sync-esb-reconcile. A leftover
--    job whose command still contains 'Authorization' is the old broken one.
select jobid, jobname, schedule, active, left(command, 200) as command
from cron.job
order by jobname;

-- 2. Did pg_cron fire?
--    "succeeded" here means ONLY that the SQL ran. net.http_post is async, so
--    this column stayed green through both outages while every HTTP call was
--    being rejected with 401. Never conclude anything from this block alone.
select j.jobname,
       r.status,
       r.start_time at time zone 'Asia/Jakarta' as start_wib,
       left(coalesce(r.return_message, ''), 200) as msg
from cron.job_run_details r
join cron.job j using (jobid)
where j.jobname like 'sync-esb%'
order by r.start_time desc
limit 20;

-- 3. THE ACTUAL ANSWER: did the HTTP call reach the function, and what did it
--    say? status_code 200 = ran; 401 = rejected at the gateway/auth guard;
--    0 = network error or timeout (see response->>'error'); -1 = pg_net pruned
--    its response before the reconcile job could copy it in.
select id, kind, dispatched_at at time zone 'Asia/Jakarta' as dispatched_wib,
       payload, status_code, response
from sync_dispatch
order by id desc
limit 20;

-- 4. Which dates actually landed, and which are missing.
--    Any gap in this list is a day with no sales data in the dashboard.
select target_date,
       count(*) filter (where status = 'success') as ok_runs,
       max(rows_synced) as rows_synced,
       max(started_at at time zone 'Asia/Jakarta') as last_run_wib
from sync_log
group by target_date
order by target_date desc
limit 30;

-- 5. Gap finder: WIB dates in the last 30 days with no successful sync at all.
select d::date as missing_date
from generate_series(
       (now() at time zone 'Asia/Jakarta')::date - 30,
       (now() at time zone 'Asia/Jakarta')::date - 1,
       interval '1 day'
     ) d
where not exists (
  select 1 from sync_log
  where target_date = d::date and status = 'success'
)
order by missing_date;

-- 6. Are both halves of the shared secret present? (Value never printed.)
--    This only proves the vault side exists -- the function-side
--    SYNC_SHARED_SECRET has to be checked with `npx supabase secrets list`,
--    and the two must match byte-for-byte.
select name, length(decrypted_secret) as secret_length
from vault.decrypted_secrets
where name = 'sync_esb_shared_secret';

-- 7. Raw pg_net responses, if you are looking within a few hours of a failure.
--    Pruned automatically, which is why block 3 exists.
select id, status_code, timed_out, left(coalesce(error_msg, ''), 200) as error_msg,
       left(coalesce(content, ''), 300) as content,
       created at time zone 'Asia/Jakarta' as created_wib
from net._http_response
order by id desc
limit 20;
