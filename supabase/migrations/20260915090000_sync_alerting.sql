-- Proactive alerting for sync-esb failures (closes the gap that let the
-- 13-19 Aug and 21-26 Aug 2026 outages run silently for days -- see
-- 20260827090000_cron_hardening.sql). `sync_dispatch` + `sync-esb-reconcile`
-- already capture the real HTTP outcome of every dispatch; this migration
-- adds a push notification on top instead of requiring someone to remember
-- to run supabase/diagnostics/sync-esb-health.sql.
--
-- Opt-in via a vault secret, same pattern as sync_esb_shared_secret: no
-- secret configured means alerting is silently off, not an error, so this
-- migration is safe to apply before anyone picks a notification channel.
--
--   select vault.create_secret('<webhook-url>', 'alert_webhook_url');
--
-- Any endpoint that accepts a JSON POST body `{"text": "..."}` works --
-- Slack and Mattermost incoming webhooks take this shape natively; for
-- Discord use a webhook URL with `?wait=true` and note it expects `content`
-- instead of `text` (swap the key below if that's the channel picked); for a
-- plain "did anything break" pulse, healthchecks.io's own ping endpoint
-- (FR-5, see supabase/functions/sync-esb/healthchecks.ts) is a separate,
-- simpler mechanism already wired at the Edge Function level and unrelated
-- to this one -- this migration is for actual failure *content* landing
-- somewhere a human reads it.

alter table sync_dispatch add column if not exists alerted_at timestamptz;

-- Backfill: mark every dispatch already sitting in the table as alerted, so
-- turning this on doesn't immediately replay every historical failure
-- (including the already-fixed Aug incidents) the moment a webhook secret is
-- set. Only genuinely new failures after this point should ever alert.
update sync_dispatch
set alerted_at = now()
where alerted_at is null
  and status_code is not null
  and status_code <> 200;

create or replace function fn_sync_esb_alert()
returns int
language plpgsql
security definer
set search_path = public, extensions, net, vault
as $$
declare
  v_webhook_url text;
  v_alerted int := 0;
  v_message text;
  r record;
begin
  select decrypted_secret into v_webhook_url
  from vault.decrypted_secrets
  where name = 'alert_webhook_url';

  if v_webhook_url is null or length(v_webhook_url) = 0 then
    return 0;
  end if;

  -- Anything sync-esb-reconcile has already resolved to a non-200 outcome.
  -- Deliberately status-code-only (not parsing response->>'body' for
  -- application-level `"ok":false`) -- that field is truncated to 2000 chars
  -- at capture time (see 20260827090000_cron_hardening.sql) and isn't
  -- guaranteed to be valid JSON once cut off.
  for r in
    select id, kind, payload, status_code, dispatched_at
    from sync_dispatch
    where alerted_at is null
      and status_code is not null
      and status_code <> 200
    order by id
    limit 20
  loop
    v_message := format(
      E'⚠️ sync-esb (%s) gagal -- status_code %s\nTarget: %s\nDikirim: %s WIB\nCek: select * from sync_dispatch where id = %s;',
      r.kind,
      r.status_code,
      coalesce(
        r.payload->>'date',
        (r.payload->>'dateFrom') || ' s/d ' || (r.payload->>'dateTo'),
        'unknown'
      ),
      to_char(r.dispatched_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI'),
      r.id
    );

    -- Fire-and-forget, same tolerance as fn_sync_esb_dispatch's own
    -- net.http_post -- a broken webhook must never block reconcile or retry
    -- forever, so alerted_at is set regardless of delivery outcome.
    perform net.http_post(
      url := v_webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('text', v_message),
      timeout_milliseconds := 10000
    );

    update sync_dispatch set alerted_at = now() where id = r.id;
    v_alerted := v_alerted + 1;
  end loop;

  return v_alerted;
end;
$$;

-- Ride the existing 10-minute reconcile cadence instead of adding a new
-- schedule -- fn_sync_esb_reconcile already runs right after
-- net._http_response is populated, so this is the earliest point a genuine
-- failure is knowable.
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

  return v_updated;
end;
$$;
