-- SUPERSEDED by 20260827090000_cron_hardening.sql, which unschedules the job
-- created here and replaces it. The `Authorization: Bearer <service_role JWT>`
-- header below is exactly what broke: the Function Gateway rejected it with
-- 401 UNAUTHORIZED_INVALID_JWT_FORMAT, twice, for days at a time. Kept only
-- because it is already applied and migrations are append-only -- do not
-- re-run this block in the SQL editor.
--
-- Daily schedule for the sync-esb Edge Function (PRD §8, FR-1/FR-2).
--
-- MANUAL STEP REQUIRED BEFORE THIS TAKES EFFECT (do this once in the
-- Supabase SQL editor of the linked project, NOT in a committed migration,
-- since it's a secret):
--
--   select vault.create_secret(
--     '<service-role-key-from-project-settings>',
--     'sync_esb_service_key'
--   );
--
-- IMPORTANT: if this migration already ran against the project before the
-- vault secret existed (or before the project ref below was correct), fixing
-- this FILE and re-running `db push` does NOT retroactively fix the job --
-- the CLI tracks this migration as already-applied and skips it. Instead,
-- run `select cron.alter_job(job_id := (select jobid from cron.job where
-- jobname = 'sync-esb-daily'), schedule := ...)` or just unschedule +
-- re-run the cron.schedule block below directly in the SQL editor.
--
-- Project ref hardcoded below is giyspsmyitlygujelqjd -- if this project is
-- ever cloned into a second (e.g. staging) Supabase project, this line needs
-- updating there too; the CLI has no per-environment templating for this.
--
-- Schedule: 06:00 WIB daily = 23:00 UTC the previous day.
select cron.schedule(
  'sync-esb-daily',
  '0 23 * * *',
  $$
  select net.http_post(
    url := 'https://giyspsmyitlygujelqjd.supabase.co/functions/v1/sync-esb',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'sync_esb_service_key'
      )
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);
