// After a sync, mv_sales_daily_outlet (see
// 20260915090100_materialized_sales_daily.sql) needs an explicit refresh --
// unlike the plain views it replaced, it doesn't reflect new raw_sales rows
// automatically. Calling this here (rather than relying only on the 10-min
// sync-esb-reconcile cron job) keeps the "Sync Manual" button's result
// instant instead of stale for up to 10 minutes. Best-effort: a refresh
// failure must never fail the sync itself, since the raw tables are already
// correct either way and reconcile will catch up.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function refreshAnalytics(client: SupabaseClient): Promise<void> {
  try {
    const { error } = await client.rpc("fn_refresh_sales_analytics");
    if (error) console.error("fn_refresh_sales_analytics failed", error);
  } catch (err) {
    console.error("fn_refresh_sales_analytics threw", err);
  }
}
