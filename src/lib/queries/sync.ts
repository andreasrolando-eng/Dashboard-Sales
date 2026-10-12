import { createClient } from "@/lib/supabase/client";

export interface DaySyncResult {
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

export interface SyncResult {
  ok: boolean;
  dateFrom: string;
  dateTo: string;
  days: DaySyncResult[];
  error?: string;
}

/**
 * FunctionsHttpError exposes the raw Response as `.context` -- the sync
 * functions always respond with a JSON body (even on failure) that has a more
 * specific `error` message than the generic HTTP error text.
 */
async function functionErrorMessage(error: Error): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context) {
    try {
      const body = await context.json();
      if (body?.error) return body.error;
    } catch {
      // not JSON / already consumed -- fall back to the generic message
    }
  }
  return error.message;
}

/**
 * Manual trigger for the sync-esb Edge Function, called from the dashboard's
 * "Sync Manual" button. Idempotent by construction, not by anything this
 * function does: the Edge Function's upsert step (supabase/functions/sync-esb/upsert.ts)
 * keys on `sales_num` (and `sales_num`+child-id for line items/payments), so
 * re-running the same date(s) only updates existing rows -- it never inserts
 * duplicates, no matter how many times it's triggered.
 *
 * The Edge Function syncs one day at a time internally (capped at 31 days
 * per request) and returns a per-day breakdown in `days`, so a partial
 * failure in a multi-day range is still visible rather than all-or-nothing.
 */
export async function triggerManualSync(dateFrom: string, dateTo: string): Promise<SyncResult> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("sync-esb", {
    body: { dateFrom, dateTo },
  });

  if (error) throw new Error(await functionErrorMessage(error));

  return data as SyncResult;
}

export interface HppSyncResult {
  ok: boolean;
  status: "success" | "partial_success" | "failed";
  snapshotDate: string;
  menus?: number;
  boms?: { total: number; ok: number; failed: number };
  failedBoms?: { bomId: number; error: string }[];
  error?: string;
}

export interface CogsSyncResult {
  ok: boolean;
  status: "success" | "partial_success" | "failed";
  from: string;
  to: string;
  partitions?: { total: number; ok: number; failed: number };
  failures?: { date: string; branch: string; error: string }[];
  error?: string;
}

/**
 * Manual trigger for the sync-esb-cogs Edge Function in "auto" mode: pulls
 * ESB's actual COGS for last month's (date, branch) partitions that are
 * missing or still inside ESB's closing window. Admins only (enforced by the
 * function). Resolves after publishing, so callers can refetch right away.
 */
export async function triggerCogsSync(): Promise<CogsSyncResult> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("sync-esb-cogs", { body: { mode: "auto", trigger: "manual" } });
  if (error) throw new Error(await functionErrorMessage(error));
  return data as CogsSyncResult;
}

/**
 * Manual trigger for the sync-esb-hpp Edge Function (admins only -- the
 * function itself enforces that). `invoke` resolves only once the function
 * has finished and published, so callers can refetch right after. A partial
 * success comes back as HTTP 207, which invoke treats as success, so check
 * `status` on the result.
 */
export async function triggerHppSync(): Promise<HppSyncResult> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("sync-esb-hpp", { body: { trigger: "manual" } });
  if (error) throw new Error(await functionErrorMessage(error));
  return data as HppSyncResult;
}
