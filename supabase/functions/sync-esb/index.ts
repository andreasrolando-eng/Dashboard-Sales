import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { fetchAllSalesForDate } from "./esb-client.ts";
import { transformSalesRecords } from "./transform.ts";
import { upsertBatch } from "./upsert.ts";
import { syncMembership } from "./membership.ts";
import { pingFailure, pingSuccess } from "./healthchecks.ts";
import { corsHeaders } from "../_shared/cors.ts";

const JOB_NAME = "sync-esb";

// Hard cap on a single request's date range so a fat-fingered "sync the
// whole year" from the dashboard can't run past the Edge Function's
// execution time limit. Large backfills should be done in a few calls.
const MAX_DAYS_PER_REQUEST = 31;

// The business (and every date in the dashboard) runs on WIB = UTC+7, while
// the cron fires at 23:00 UTC. A plain UTC "yesterday" at that instant is
// TWO days back in WIB, so the nightly run would silently sync a stale date
// and yesterday's data would never appear until the following night.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function yesterdayWIB(): string {
  return new Date(Date.now() + WIB_OFFSET_MS - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Gateway JWT verification is OFF for this function (see
// `[functions.sync-esb] verify_jwt = false` in supabase/config.toml), because
// it proved flaky for the long-lived static token the cron job had to send --
// the gateway rejected it with 401 UNAUTHORIZED_INVALID_JWT_FORMAT before any
// of this code ran, which is invisible in `cron.job_run_details` and cost
// several days of un-synced data twice. Auth is therefore enforced HERE, and
// this function must never be deployed without it.
const SYNC_SHARED_SECRET = Deno.env.get("SYNC_SHARED_SECRET") ?? "";

function secretMatches(provided: string | null): boolean {
  if (!SYNC_SHARED_SECRET || !provided || provided.length !== SYNC_SHARED_SECRET.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ SYNC_SHARED_SECRET.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Two callers, two credentials:
 * - cron (pg_net) sends `x-sync-secret`, read from the `sync_esb_shared_secret`
 *   vault secret -- a plain string, so nothing about it can expire or be
 *   re-validated by the gateway.
 * - the dashboard's "Sync Manual" button sends a logged-in user's session JWT,
 *   which we verify ourselves now that the gateway no longer does.
 */
async function isAuthorized(req: Request, client: SupabaseClient): Promise<boolean> {
  if (secretMatches(req.headers.get("x-sync-secret"))) return true;

  const header = req.headers.get("Authorization") ?? "";
  const token = /^bearer /i.test(header) ? header.slice(7).trim() : "";
  if (!token) return false;
  if (secretMatches(token)) return true;

  const { data, error } = await client.auth.getUser(token);
  return !error && !!data.user;
}

function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

interface DaySyncResult {
  date: string;
  ok: boolean;
  recordsFetched?: number;
  outlets?: number;
  sales?: number;
  payments?: number;
  menuItems?: number;
  membershipRows?: number;
  error?: string;
}

/** One sync_log row per day synced, so a multi-day backfill's partial failures stay individually auditable. */
async function syncOneDay(client: SupabaseClient, targetDate: string): Promise<DaySyncResult> {
  const { data: logRow, error: logError } = await client
    .from("sync_log")
    .insert({ job_name: JOB_NAME, target_date: targetDate, status: "running" })
    .select("id")
    .single();

  if (logError || !logRow) {
    console.error("Failed to write sync_log start row", logError);
  }

  try {
    const records = await fetchAllSalesForDate(targetDate);
    const batch = transformSalesRecords(records);
    const result = await upsertBatch(client, batch);
    const membership = await syncMembership(client);

    const totalRows = result.outlets + result.sales + result.payments + result.menuItems + membership.rows;

    if (logRow) {
      await client
        .from("sync_log")
        .update({ finished_at: new Date().toISOString(), status: "success", rows_synced: totalRows })
        .eq("id", logRow.id);
    }

    return {
      date: targetDate,
      ok: true,
      recordsFetched: records.length,
      ...result,
      membershipRows: membership.rows,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`sync-esb failed for ${targetDate}`, message);

    if (logRow) {
      await client
        .from("sync_log")
        .update({ finished_at: new Date().toISOString(), status: "failed", error_message: message })
        .eq("id", logRow.id);
    }

    return { date: targetDate, ok: false, error: message };
  }
}

Deno.serve(async (req) => {
  // Preflight for the dashboard's manual-sync button (browser calls, unlike
  // curl/CLI/cron, enforce CORS). Not needed for the cron trigger itself.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (!(await isAuthorized(req, client))) {
    console.error("sync-esb: unauthorized request rejected");
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  // Body shapes: {date} for a single day (the cron job sends an explicit
  // WIB-derived date; the `yesterdayWIB()` fallback only covers a bare
  // trigger), or {dateFrom, dateTo} for a range (the manual sync button).
  let dates: string[];
  const body = await req.json().catch(() => ({}));
  if (typeof body?.dateFrom === "string" && typeof body?.dateTo === "string") {
    dates = dateRange(body.dateFrom, body.dateTo);
  } else if (typeof body?.date === "string") {
    dates = [body.date];
  } else {
    dates = [yesterdayWIB()];
  }

  if (dates.length === 0) {
    return Response.json(
      { ok: false, error: "dateFrom is after dateTo" },
      { status: 400, headers: corsHeaders }
    );
  }
  if (dates.length > MAX_DAYS_PER_REQUEST) {
    return Response.json(
      { ok: false, error: `Range too large (${dates.length} days) -- max ${MAX_DAYS_PER_REQUEST} per request, split into multiple syncs.` },
      { status: 400, headers: corsHeaders }
    );
  }

  const days: DaySyncResult[] = [];
  for (const date of dates) {
    days.push(await syncOneDay(client, date));
  }

  const failedDays = days.filter((d) => !d.ok);
  const allFailed = failedDays.length === days.length;
  const totalRows = days.reduce(
    (sum, d) => sum + (d.ok ? (d.outlets ?? 0) + (d.sales ?? 0) + (d.payments ?? 0) + (d.menuItems ?? 0) + (d.membershipRows ?? 0) : 0),
    0
  );

  const summary = `sync-esb ${dates[0]}..${dates[dates.length - 1]}: ${totalRows} rows total, ${failedDays.length}/${days.length} day(s) failed`;
  await (allFailed ? pingFailure : pingSuccess)(summary);

  return Response.json(
    { ok: !allFailed, dateFrom: dates[0], dateTo: dates[dates.length - 1], days },
    { status: allFailed ? 500 : 200, headers: corsHeaders }
  );
});
