import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { identifyCaller, isAdminEmail } from "../_shared/auth.ts";
import { fetchAllMenus } from "./esb-oms-client.ts";
import { EsbCoreClient } from "../_shared/esb-core-client.ts";
import { mapWithConcurrency } from "../_shared/http.ts";
import { fetchBomLines } from "./bom.ts";
import type { BomFailure, BomLineRow, EsbMenuRecord, MenuRow } from "./types.ts";

const JOB_NAME = "sync-esb-hpp";
const BOM_CONCURRENCY = Number(Deno.env.get("ESB_HPP_BOM_CONCURRENCY") ?? 5);
// Stop starting new BOM fetches after this long, leaving headroom to publish
// before the Edge Function's wall-clock limit kills the run. BOMs not reached
// are reported as failed (-> partial_success) and keep their last snapshot.
const BOM_TIME_BUDGET_MS = Number(Deno.env.get("ESB_HPP_TIME_BUDGET_MS") ?? 120_000);
// A run still marked `running` younger than this blocks a new one, so a
// double-click or cron+manual overlap doesn't hammer ESB twice.
const RUNNING_LOCK_MINUTES = 15;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
function todayWIB(): string {
  return new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: corsHeaders });
}

function toMenuRows(records: EsbMenuRecord[]): MenuRow[] {
  // Keyed by menuID: one upsert can't touch the same row twice.
  const byId = new Map<number, MenuRow>();
  for (const r of records) {
    if (typeof r.menuID !== "number") continue;
    byId.set(r.menuID, {
      menu_id: r.menuID,
      menu_code: r.menuCode ?? null,
      menu_name: r.menuName ?? null,
      bom_id: r.bomID && r.bomID > 0 ? r.bomID : null,
      bom_name: r.bomName || null,
      category_detail: r.categoryDetail ?? null,
      flag_active: r.flagActive ?? null,
      is_package: Array.isArray(r.menuPackages?.menuGroup) && r.menuPackages.menuGroup.length > 0,
    });
  }
  return [...byId.values()];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const caller = await identifyCaller(req, client);
  if (!caller) return json({ ok: false, error: "Unauthorized" }, 401);
  if (caller.via === "user" && !(await isAdminEmail(client, caller.email))) {
    return json({ ok: false, error: "Hanya admin yang bisa menjalankan sync HPP" }, 403);
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
    return json({ ok: false, error: "Sync HPP lain sedang berjalan, coba lagi beberapa menit lagi" }, 409);
  }

  const snapshotDate = todayWIB();
  const { data: logRow } = await client
    .from("sync_log")
    .insert({ job_name: JOB_NAME, target_date: snapshotDate, status: "running" })
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
    EsbCoreClient.assertConfigured();

    const menus = toMenuRows(await fetchAllMenus());
    if (menus.length === 0) throw new Error("ESB get-menu returned 0 menus -- nothing published");

    const bomIds = [...new Set(menus.map((m) => m.bom_id).filter((id): id is number => id !== null))];

    const core = new EsbCoreClient();
    await core.init();

    const started = Date.now();
    const failures: BomFailure[] = [];
    const lines: BomLineRow[] = [];
    await mapWithConcurrency(bomIds, BOM_CONCURRENCY, async (bomId) => {
      if (Date.now() - started > BOM_TIME_BUDGET_MS) {
        failures.push({ bomId, error: "time budget exceeded, not fetched this run" });
        return;
      }
      try {
        lines.push(...(await fetchBomLines(core, bomId)));
      } catch (err) {
        failures.push({ bomId, error: err instanceof Error ? err.message : String(err) });
      }
    });

    if (bomIds.length > 0 && failures.length === bomIds.length) {
      throw new Error(`All ${bomIds.length} BOM fetches failed (first: ${failures[0].error}) -- nothing published`);
    }

    const { data: published, error: publishError } = await client.rpc("fn_hpp_publish", {
      p_snapshot_date: snapshotDate,
      p_menus: menus,
      p_bom_lines: lines,
    });
    if (publishError) throw new Error(`fn_hpp_publish failed: ${publishError.message}`);

    const status = failures.length > 0 ? "partial_success" : "success";
    const snapshots = (published as { snapshots?: number } | null)?.snapshots ?? null;
    await finishLog(
      status,
      snapshots,
      failures.length > 0 ? `${failures.length}/${bomIds.length} BOM gagal diambil (contoh: BOM ${failures[0].bomId}: ${failures[0].error})` : null
    );

    return json(
      {
        ok: true,
        status,
        snapshotDate,
        menus: menus.length,
        boms: { total: bomIds.length, ok: bomIds.length - failures.length, failed: failures.length },
        failedBoms: failures.slice(0, 50),
        published,
      },
      // 207 on partial success on purpose: fn_sync_esb_alert fires on any
      // non-200, so a cron run that skipped BOMs still raises an alert.
      status === "success" ? 200 : 207
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sync-esb-hpp failed", message);
    await finishLog("failed", null, message);
    return json({ ok: false, status: "failed", snapshotDate, error: message }, 500);
  }
});
