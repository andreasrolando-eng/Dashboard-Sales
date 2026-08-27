-- Rebuild of the sync-esb schedule after two multi-day sync outages that the
-- old setup could not even report (13-19 Aug and 21 Aug 2026).
--
-- Three separate defects are fixed here; the first is why the job "ran" every
-- night while nothing was ever synced.
--
-- 1. AUTH. The old job sent `Authorization: Bearer <service_role JWT>` read
--    from vault, and the Supabase Function Gateway verified it. That
--    verification rejected the token with 401 UNAUTHORIZED_INVALID_JWT_FORMAT
--    before the Edge Function's code ran -- sometimes for a week straight,
--    sometimes intermittently with a byte-identical secret. The gateway no
--    longer verifies this function (`[functions.sync-esb] verify_jwt = false`
--    in supabase/config.toml); the job now sends a plain `x-sync-secret`
--    header that the function checks itself. Nothing in that path can expire
--    or be re-parsed as a JWT.
--
-- 2. WRONG DATE. The job fired at 23:00 UTC and let the function default to
--    UTC-yesterday. At 23:00 UTC it is already 06:00 the NEXT day in WIB, so
--    UTC-yesterday is two days back in WIB: yesterday's sales were never the
--    target of the run that was supposed to fetch them. The target date is now
--    computed explicitly in WIB and sent in the body.
--
-- 3. INVISIBLE FAILURES. `net.http_post` is async, so `cron.job_run_details`
--    said "succeeded" for every one of those failed nights -- it only proves
--    the SQL dispatched. The real status lived in `net._http_response`, which
--    pg_net prunes after a few hours, so by the time anyone looked the
--    evidence was gone. Dispatches are now recorded in `sync_dispatch` and a
--    reconcile job copies the HTTP outcome in before pg_net drops it.
--
-- Plus a catch-up job so a single bad night self-heals instead of becoming a
-- permanent gap (the upserts are keyed on sales_num, so re-syncing a day that
-- already succeeded is a no-op).
--
-- MANUAL STEPS REQUIRED, IN THIS ORDER -- the middle one is a secret, so it
-- cannot live in a committed migration:
--
--   a. Deploy the function FIRST (it carries the new auth guard, and this
--      migration stops sending the header the old gateway check wanted):
--        npx supabase functions deploy sync-esb
--   b. Pick one random string and set it in BOTH places, identical:
--        npx supabase secrets set SYNC_SHARED_SECRET='<random-string>'
--        -- and in the SQL editor:
--        select vault.create_secret('<random-string>', 'sync_esb_shared_secret');
--   c. Apply this migration (`npx supabase db push`).
--
-- The old `sync_esb_service_key` vault secret is no longer read by anything
-- and can be deleted once this is confirmed working.

-- ---------------------------------------------------------------------------
-- Durable record of every dispatch, so a failing cron is provable after the
-- fact instead of only while pg_net still holds the response.
-- ---------------------------------------------------------------------------
create table if not exists sync_dispatch (
  id bigint generated always as identity primary key,
  kind text not null,
  request_id bigint,
  payload jsonb,
  dispatched_at timestamptz not null default now(),
  status_code int,
  response jsonb,
  checked_at timestamptz
);

create index if not exists sync_dispatch_pending_idx
  on sync_dispatch (dispatched_at) where status_code is null;

alter table sync_dispatch enable row level security;
revoke all on sync_dispatch from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dispatch helper. Centralises the vault read so a missing/empty secret raises
-- and lands in cron.job_run_details as a FAILED run -- the old inline
-- `'Bearer ' || (select ...)` silently produced a NULL header instead, which
-- is indistinguishable from success at the cron level.
-- ---------------------------------------------------------------------------
create or replace function fn_sync_esb_dispatch(p_kind text, p_body jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, net, vault
as $$
declare
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'sync_esb_shared_secret';

  if v_secret is null or length(v_secret) = 0 then
    raise exception
      'vault secret "sync_esb_shared_secret" is missing or empty -- sync-esb cannot authenticate';
  end if;

  -- 180s: the function syncs day-by-day against a paginated upstream API, so
  -- it routinely runs well past pg_net's 5000ms default. On that default the
  -- worker aborts the connection mid-sync and records a timeout.
  select net.http_post(
    url := 'https://giyspsmyitlygujelqjd.supabase.co/functions/v1/sync-esb',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', v_secret
    ),
    body := p_body,
    timeout_milliseconds := 180000
  ) into v_request_id;

  insert into sync_dispatch (kind, request_id, payload)
  values (p_kind, v_request_id, p_body);

  return v_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reconcile pg_net responses into sync_dispatch before they are pruned.
-- ---------------------------------------------------------------------------
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

  -- pg_net drops _http_response rows after a few hours. Anything still
  -- unmatched by then never will be, and a permanently NULL status_code reads
  -- as "still in flight" rather than "we lost the answer".
  update sync_dispatch
  set status_code = -1,
      response = jsonb_build_object('error', 'pg_net response was pruned before reconcile ran'),
      checked_at = now()
  where status_code is null
    and dispatched_at < now() - interval '6 hours';

  return v_updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schedules. Unschedule by name first: this migration REPLACES the job created
-- by 20260813090700_cron_schedule.sql, and cron.schedule() would otherwise
-- only overwrite an exact name match while leaving strays behind.
-- ---------------------------------------------------------------------------
do $$
declare
  v_jobid bigint;
begin
  for v_jobid in
    select jobid from cron.job
    where jobname in ('sync-esb-daily', 'sync-esb-catchup', 'sync-esb-reconcile')
  loop
    perform cron.unschedule(v_jobid);
  end loop;
end;
$$;

-- 23:00 UTC = 06:00 WIB. Target date is yesterday *in WIB*, computed here so
-- the value is visible in sync_dispatch.payload rather than inferred inside
-- the function.
select cron.schedule(
  'sync-esb-daily',
  '0 23 * * *',
  $$
  select public.fn_sync_esb_dispatch(
    'daily',
    jsonb_build_object(
      'trigger', 'cron',
      'date', to_char((now() at time zone 'Asia/Jakarta')::date - 1, 'YYYY-MM-DD')
    )
  );
  $$
);

-- 03:00 UTC = 10:00 WIB. Re-syncs the last 3 WIB days so one failed night (or
-- a late-arriving ESB transaction) fills itself in without anyone noticing.
select cron.schedule(
  'sync-esb-catchup',
  '0 3 * * *',
  $$
  select public.fn_sync_esb_dispatch(
    'catchup',
    jsonb_build_object(
      'trigger', 'cron-catchup',
      'dateFrom', to_char((now() at time zone 'Asia/Jakarta')::date - 3, 'YYYY-MM-DD'),
      'dateTo', to_char((now() at time zone 'Asia/Jakarta')::date - 1, 'YYYY-MM-DD')
    )
  );
  $$
);

select cron.schedule(
  'sync-esb-reconcile',
  '*/10 * * * *',
  $$ select public.fn_sync_esb_reconcile(); $$
);
