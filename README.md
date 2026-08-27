# ESB Analytics — Dashboard Sales, Membership & Marketing

Internal executive dashboard for F&B sales/membership/marketing performance. Next.js (App Router) on Vercel, Supabase Postgres + Edge Functions + Cron as the backend, data synced daily from the ESB OMS API. Built from `design_handoff_sales_dashboard/` (PRD + design reference).

## Stack

- **App**: Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4, TanStack Query, Recharts.
- **Backend**: Supabase Postgres (raw tables + aggregation views/functions), Supabase Auth, Supabase Edge Functions (Deno), `pg_cron`/`pg_net` for scheduling.
- **Hosting**: Vercel (app), Supabase (data/ETL), healthchecks.io (free job monitoring).

## Status / known gaps

Project is linked to a live Supabase project (`giyspsmyitlygujelqjd`) with all migrations pushed. Remaining:

1. ~~**ESB request contract.**~~ Resolved — `supabase/functions/sync-esb/esb-client.ts` now uses the confirmed real endpoint (`{ESB_API_BASE_URL}/corev1/sales/sales-information`), Bearer auth, and the real `salesDateFrom`/`salesDateTo`/`page`/`sortBy`/`sortOrder` params. `ESB_API_BASE_URL`/`ESB_API_KEY` secrets are set; deploy with `npx supabase functions deploy sync-esb` to pick them up.
2. **Membership profile endpoint.** No sample was available for ESB's membership endpoint, so `supabase/functions/sync-esb/membership.ts` is a feature-flagged stub (`ESB_MEMBERSHIP_ENDPOINT` unset = no-op). Membership *analytics* (visits, spending, retention, new members, tier) already work off `memberCode`/`memberName` on sales records with a spending-bracket tier fallback — only `raw_members.tier`/`join_date` accuracy improves once this is wired.
3. ~~**Cron job auth.**~~ Resolved — reworked and deployed 27 Aug 2026 after three multi-day sync outages (see `supabase/migrations/20260827090000_cron_hardening.sql`). The job no longer sends a JWT; it sends an `x-sync-secret` header checked inside the Edge Function, and `verify_jwt` is off for `sync-esb`. Requires the `SYNC_SHARED_SECRET` function secret and the `sync_esb_shared_secret` Vault secret to hold the **same** value — see §3 below. Diagnose with `select * from sync_dispatch order by id desc`, not `cron.job_run_details` (which only proves the SQL dispatched, never that the HTTP call succeeded).

## Setup

### 1. Install

```bash
npm install
cp .env.local.example .env.local
```

### 2. Supabase project

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies supabase/migrations/*.sql
```

Fill in `.env.local` from Project Settings → API (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Leave `NEXT_PUBLIC_USE_MOCK_DATA` unset/`false`.

Create at least one Auth user for yourself (Dashboard → Authentication → Users → Add user, or `npx supabase auth users create` — there's no self-signup by design, matching the PRD's "akses terbatas untuk management/eksekutif").

### 3. Edge Function (ETL)

```bash
npx supabase functions deploy sync-esb
npx supabase secrets set ESB_API_BASE_URL=... ESB_API_KEY=... HEALTHCHECKS_PING_URL=...
```

Then pick one random string and set it in **both** places — the cron job sends it as `x-sync-secret`, the function compares against it, and they must match byte-for-byte:

```bash
npx supabase secrets set SYNC_SHARED_SECRET='<random-string>'
```

```sql
-- Supabase SQL editor (not a committed migration, since it's a secret):
select vault.create_secret('<random-string>', 'sync_esb_shared_secret');
```

Deploy the function **before** pushing `20260827090000_cron_hardening.sql`: that migration stops sending the `Authorization` header the old gateway check wanted, so an un-redeployed function would reject every cron call.

Order matters for a second reason too — editing an *already-applied* migration and re-running `db push` does nothing (the CLI tracks it as applied and skips it). Live cron changes must either come in a new migration file or be run directly in the SQL editor.

The schedule this creates: daily sync at 06:00 WIB (FR-1/FR-2), a catch-up re-sync of the last 3 days at 10:00 WIB so one failed night self-heals, and a reconcile job every 10 min that copies pg_net's HTTP result into `sync_dispatch` before pg_net prunes it. Test the function itself manually first, independent of cron:

```bash
curl -sS -X POST 'https://<project-ref>.supabase.co/functions/v1/sync-esb' \
  -H 'Content-Type: application/json' \
  -H 'x-sync-secret: <random-string>' \
  -d '{"date":"2026-08-01"}'
```

`npx supabase functions invoke` won't work for this function any more — it sends an anon/service key as `Authorization`, and the in-function guard only accepts the shared secret or a real logged-in user's session JWT. Use curl with the header above, which is exactly what the cron job sends.

Check `sync_log` for the run, and set up a healthchecks.io check pointed at `HEALTHCHECKS_PING_URL` for FR-5's failure alerting.

### 4. Run the app

```bash
npm run dev
```

### 5. Deploy

Push to a Git remote and import into Vercel (zero special config — see `.env.local.example` for the env vars to set in Vercel's project settings). No `vercel.json`/adapter config needed.

## Local UI QA without a Supabase project

`NEXT_PUBLIC_USE_MOCK_DATA=true` (only takes effect when `NODE_ENV !== "production"`) makes the query layer and auth guard use fixture data instead of Supabase, so `npm run dev` is fully explorable with no backend at all. See `src/lib/mock/`. This path cannot activate in a real deploy — don't set this env var in Vercel/production.

## Repo layout

- `src/app/` — routes: `/login`, `/dashboard` (single shell; tabs are a `?tab=` search param per the design spec, not separate routes).
- `src/components/tabs/` — Overview / Sales / Membership / Marketing tab bodies.
- `src/lib/queries/` — typed Supabase query façade (one function per view/RPC).
- `src/lib/recommendations.ts` — FR-30–32 rule-based promo/menu recommendations.
- `supabase/migrations/` — raw tables, RLS, aggregation views, `fn_menu_performance`/`fn_promo_performance`/`fn_membership_summary`/`fn_top_members` (FR-21–29), cron schedule.
- `supabase/functions/sync-esb/` — daily ETL Edge Function.
- `supabase/seed.sql` — synthetic fixture data shaped like the real ESB payload, for local/reference use.

## Design deviations from the mock (and why)

- **Category filter is dynamic**, not the 4 hardcoded buckets (Makanan/Minuman/Dessert/Snack) in the design reference — real ESB `menuCategoryName` values are outlet-specific.
- **Charts use Recharts** for the trend/peak-hour/weekly bar charts; the two donuts stay CSS `conic-gradient` (same technique the reference itself uses — simpler and pixel-exact for a static 2-segment ring, no library needed).
- **Revenue trend deltas ("+8.4% vs periode lalu") are real**, computed against the immediately preceding period of equal length — the design reference hardcodes these.
