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

function yesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
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

  // Body shapes: {date} for a single day (cron always sends {trigger:'cron'},
  // which falls through to "yesterday"), or {dateFrom, dateTo} for a range
  // (the dashboard's manual sync button).
  let dates: string[];
  const body = await req.json().catch(() => ({}));
  if (typeof body?.dateFrom === "string" && typeof body?.dateTo === "string") {
    dates = dateRange(body.dateFrom, body.dateTo);
  } else if (typeof body?.date === "string") {
    dates = [body.date];
  } else {
    dates = [yesterday()];
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
