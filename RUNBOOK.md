# Runbook

Operational incident response, distilled from `PROGRESS.md`'s dev-log prose
into checklist form. `PROGRESS.md` has the full incident history and reasoning
if you need the "why"; this file is just the "what to do right now."

## Sync stopped / dashboard looks stale or empty

1. Run `supabase/diagnostics/sync-esb-health.sql` in the Supabase SQL editor,
   in order. Block 2 (`cron.job_run_details`) almost always says "succeeded"
   even when the sync is fully broken -- `net.http_post` is fire-and-forget,
   so that column only proves the SQL dispatch ran, not that the HTTP call
   reached the function. **Block 3 (`sync_dispatch`) is the real answer**:
   `status_code` 200 = ran, 401 = rejected before the function code ran
   (auth/secret mismatch), 0 = network error/timeout, -1 = pg_net pruned its
   response before `sync-esb-reconcile` could copy it in.
2. If `status_code` is 401: check `npx supabase secrets list` for
   `SYNC_SHARED_SECRET` and compare its length/update time against the vault
   secret via diagnostic block 6 -- they have to match byte-for-byte. Fixing a
   mismatched secret requires redeploying the function *before* re-setting the
   secret (see the deploy-order note in `PROGRESS.md`'s item 1), otherwise the
   old code path is still live when the new secret lands.
3. Use diagnostic blocks 4 and 5 to find exactly which dates are missing, then
   either wait for `sync-esb-catchup` (re-syncs the last 3 days automatically,
   runs daily) or trigger a manual re-sync for older gaps via the dashboard's
   "Sync Manual" button.
4. If an `alert_webhook_url` vault secret is configured (see
   `supabase/migrations/20260915090000_sync_alerting.sql`), a Slack/Discord/
   Mattermost message should already have fired for any non-200 dispatch --
   check that channel first, it may have already told you which day and what
   status code before you open the SQL editor at all.

## Materialized view looks stale (Overview/Sales numbers not updating)

`v_sales_daily_outlet` is a thin wrapper over `mv_sales_daily_outlet`, refreshed
by `fn_refresh_sales_analytics()` right after every sync (best-effort, see
`supabase/functions/sync-esb/refresh-analytics.ts`) and again every 10 minutes
by `sync-esb-reconcile` as a self-healing backstop. If numbers are still stale
after 10+ minutes, manually run `select fn_refresh_sales_analytics();` in the
SQL editor and check for an error.

## A user can't log in (Google SSO)

Login is Google OAuth only (no password) -- see `src/app/login/` and
`src/app/auth/callback/route.ts`. Two independent gates, checked in this order:

1. **`domain_not_allowed`**: their Google account's email isn't `@esb.co.id`
   (`ALLOWED_EMAIL_DOMAIN` env var). Not fixable per-user -- they need to use
   their company Google account, not a personal one.
2. **`not_registered`**: their email passed the domain check but isn't in the
   `allowed_users` table (`supabase/migrations/20260917090000_google_sso_allowlist.sql`).
   This is the actual access allowlist -- Google OAuth alone would otherwise
   auto-create an account for anyone at the company. **To grant access**:
   ```sql
   insert into allowed_users (email) values ('nama@esb.co.id');
   ```
   No self-service invite flow exists -- this is a manual SQL insert today.

**"Remember me" not behaving as expected**: see `src/lib/supabase/remember-me.ts`
for how it's enforced (an app-level gate, not a cookie `Max-Age` Supabase's own
SDK controls) before assuming it's a bug.

## Deploy checklist (Edge Function changes)

Deploy the function *before* setting/rotating any secret it depends on, then
run migrations. Reversed order causes every cron call to be rejected until
corrected (this exact mistake caused a real multi-day outage -- see
`PROGRESS.md` item 1).

## Where things live

- Sync diagnostics: `supabase/diagnostics/sync-esb-health.sql`
- Sync alerting/reconcile: `supabase/migrations/20260915090000_sync_alerting.sql`
- Materialized view refresh: `supabase/migrations/20260915090100_materialized_sales_daily.sql`
- Edge Function: `supabase/functions/sync-esb/`
- Full incident history and reasoning: `PROGRESS.md`
