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

  if (error) {
    // FunctionsHttpError exposes the raw Response as `.context` -- the
    // function always responds with a JSON body (even on failure) that has
    // a more specific `error` message than the generic HTTP error text.
    const context = (error as { context?: Response }).context;
    let message = error.message;
    if (context) {
      try {
        const body = await context.json();
        if (body?.error) message = body.error;
      } catch {
        // not JSON / already consumed -- fall back to the generic message
      }
    }
    throw new Error(message);
  }

  return data as SyncResult;
}
