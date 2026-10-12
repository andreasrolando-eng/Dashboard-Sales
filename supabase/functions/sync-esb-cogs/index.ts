import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { identifyCaller, isAdminEmail } from "../_shared/auth.ts";
import { EsbCoreClient } from "../_shared/esb-core-client.ts";
import { mapWithConcurrency } from "../_shared/http.ts";

// Pulls ESB Core's actual COGS reports for CLOSED months, one partition
// (sales date x branch) at a time, and publishes each atomically via
// fn_esb_cogs_publish (supabase/migrations/20261014090000_esb_cogs.sql):
//   report/sales-menu-cogs        (Package Summary) -> COGS per menu line
//   report/sales-menu-cogs-detail (mode recap)      -> COGS per ingredient
//
// Body:
//   {dateFrom, dateTo}  manual/backfill: (re)fetch every partition with sales
//                       in the range. Dates must be in closed months.
//   {mode: "auto"}      cron: previous month's partitions that were never
//                       fetched, plus -- until day REFETCH_UNTIL_DAY of the
//                       current month, ESB's closing window -- ones fetched
//                       more than a day ago, so closing-time corrections land.

const JOB_NAME = "sync-esb-cogs";
const CONCURRENCY = Number(Deno.env.get("ESB_COGS_CONCURRENCY") ?? 3);
const TIME_BUDGET_MS = Number(Deno.env.get("ESB_COGS_TIME_BUDGET_MS") ?? 120_000);
const REFETCH_UNTIL_DAY = Number(Deno.env.get("ESB_COGS_REFETCH_UNTIL_DAY") ?? 20);
const MAX_RANGE_DAYS = 62;
const RUNNING_LOCK_MINUTES = 15;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

interface EsbBranch {
  branchID: number;
  branchCode: string;
  branchName: string;
}

interface Partition {
  sales_date: string;
  branch_code: string;
  fetched_at: string | null;
}

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: corsHeaders });
}

function todayWIB(): Date {
  return new Date(Date.now() + WIB_OFFSET_MS);
}

/** First day of the current WIB month as YYYY-MM-DD: dates before it are closed. */
function closedBefore(): string {
  return `${todayWIB().toISOString().slice(0, 7)}-01`;
}

function previousMonthRange(): { from: string; to: string } {
  const first = new Date(`${closedBefore()}T00:00:00Z`);
  const lastPrev = new Date(first.getTime() - 24 * 60 * 60 * 1000);
  return { from: `${lastPrev.toISOString().slice(0, 7)}-01`, to: lastPrev.toISOString().slice(0, 10) };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const caller = await identifyCaller(req, client);
  if (!caller) return json({ ok: false, error: "Unauthorized" }, 401);
  if (caller.via === "user" && !(await isAdminEmail(client, caller.email))) {
    return json({ ok: false, error: "Hanya admin yang bisa menjalankan sync COGS" }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const auto = body?.mode === "auto";
  let from: string;
  let to: string;
  if (auto) {
    ({ from, to } = previousMonthRange());
  } else if (typeof body?.dateFrom === "string" && typeof body?.dateTo === "string") {
    from = body.dateFrom;
    to = body.dateTo;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      return json({ ok: false, error: "dateFrom/dateTo must be YYYY-MM-DD with dateFrom <= dateTo" }, 400);
    }
    if (to >= closedBefore()) {
      return json({ ok: false, error: `Hanya bulan yang sudah tutup (sebelum ${closedBefore()}) -- COGS ESB bulan berjalan belum final` }, 400);
    }
    if (daysBetween(from, to) > MAX_RANGE_DAYS) {
      return json({ ok: false, error: `Rentang maksimal ${MAX_RANGE_DAYS} hari per request` }, 400);
    }
  } else {
    return json({ ok: false, error: 'Body must be {dateFrom, dateTo} or {mode: "auto"}' }, 400);
  }

  const lockSince = new Date(Date.now() - RUNNING_LOCK_MINUTES * 60_000).toISOString();
  const { data: running } = await client
    .from("sync_log")
    .select("id")
    .eq("job_name", JOB_NAME)
    .eq("status", "running")
    .gte("started_at", lockSince)
    .limit(1);
  if (running && running.length > 0) {
    return json({ ok: false, error: "Sync COGS lain sedang berjalan, coba lagi beberapa menit lagi" }, 409);
  }

  const { data: logRow } = await client
    .from("sync_log")
    .insert({ job_name: JOB_NAME, target_date: from, status: "running" })
    .select("id")
    .single();

  async function finishLog(status: "success" | "partial_success" | "failed", rows: number | null, message: string | null) {
    if (!logRow) return;
    await client
      .from("sync_log")
      .update({ finished_at: new Date().toISOString(), status, rows_synced: rows, error_message: message })
      .eq("id", logRow.id);
  }

  try {
    const { data: partitionData, error: partitionError } = await client.rpc("fn_esb_cogs_partitions", { p_from: from, p_to: to });
    if (partitionError) throw new Error(`fn_esb_cogs_partitions failed: ${partitionError.message}`);
    let partitions = (partitionData ?? []) as Partition[];

    if (auto) {
      const inClosingWindow = todayWIB().getUTCDate() <= REFETCH_UNTIL_DAY;
      const staleBefore = Date.now() - 24 * 60 * 60 * 1000;
      partitions = partitions.filter(
        (p) => p.fetched_at === null || (inClosingWindow && Date.parse(p.fetched_at) < staleBefore)
      );
    }

    if (partitions.length === 0) {
      await finishLog("success", 0, null);
      return json({ ok: true, status: "success", from, to, partitions: { total: 0, ok: 0, failed: 0 } }, 200);
    }

    EsbCoreClient.assertConfigured();
    const core = new EsbCoreClient();
    await core.init();
    const branches = new Map((await core.get<EsbBranch[]>("/branch")).map((b) => [b.branchCode, b]));

    const started = Date.now();
    const failures: { date: string; branch: string; error: string }[] = [];
    let published = 0;
    let rows = 0;

    await mapWithConcurrency(partitions, CONCURRENCY, async (p) => {
      if (Date.now() - started > TIME_BUDGET_MS) {
        failures.push({ date: p.sales_date, branch: p.branch_code, error: "time budget exceeded, not fetched this run" });
        return;
      }
      const branch = branches.get(p.branch_code);
      if (!branch) {
        failures.push({ date: p.sales_date, branch: p.branch_code, error: "no ESB Core branch with this branch code" });
        return;
      }
      try {
        const q = { branchID: branch.branchID, salesDate: p.sales_date };
        const [menuRows, ingredientRows] = await Promise.all([
          core.getAllPages<Record<string, unknown>>("/report/sales-menu-cogs", { ...q, salesMenuCogsType: "Package Summary" }),
          core.getAllPages<Record<string, unknown>>("/report/sales-menu-cogs-detail", { ...q, mode: "recap", limit: 20 }),
        ]);
        const { data, error } = await client.rpc("fn_esb_cogs_publish", {
          p_sales_date: p.sales_date,
          p_branch_code: p.branch_code,
          p_menu_rows: menuRows,
          p_ingredient_rows: ingredientRows,
        });
        if (error) throw new Error(`publish: ${error.message}`);
        published += 1;
        rows += ((data as { menu_rows?: number } | null)?.menu_rows ?? 0);
      } catch (err) {
        failures.push({ date: p.sales_date, branch: p.branch_code, error: err instanceof Error ? err.message : String(err) });
      }
    });

    const status = published === 0 ? "failed" : failures.length > 0 ? "partial_success" : "success";
    const message =
      failures.length > 0
        ? `${failures.length}/${partitions.length} partisi gagal (contoh: ${failures[0].date} ${failures[0].branch}: ${failures[0].error})`
        : null;
    await finishLog(status, rows, message);

    return json(
      {
        ok: status !== "failed",
        status,
        from,
        to,
        partitions: { total: partitions.length, ok: published, failed: failures.length },
        failures: failures.slice(0, 50),
      },
      // 207 on partial success so the existing alert (any non-200) fires.
      status === "success" ? 200 : status === "partial_success" ? 207 : 500
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sync-esb-cogs failed", message);
    await finishLog("failed", null, message);
    return json({ ok: false, status: "failed", from, to, error: message }, 500);
  }
});
