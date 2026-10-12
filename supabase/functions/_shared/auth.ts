import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Gateway JWT verification is OFF for the sync functions (see
// `[functions.sync-esb] verify_jwt = false` in supabase/config.toml), because
// it proved flaky for the long-lived static token the cron job had to send --
// the gateway rejected it with 401 UNAUTHORIZED_INVALID_JWT_FORMAT before any
// function code ran, which is invisible in `cron.job_run_details` and cost
// several days of un-synced data twice. Auth is therefore enforced in code,
// and no function using this may be deployed without calling it.
const SYNC_SHARED_SECRET = Deno.env.get("SYNC_SHARED_SECRET") ?? "";

function secretMatches(provided: string | null): boolean {
  if (!SYNC_SHARED_SECRET || !provided || provided.length !== SYNC_SHARED_SECRET.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ SYNC_SHARED_SECRET.charCodeAt(i);
  }
  return diff === 0;
}

export type Caller = { via: "secret" } | { via: "user"; email: string | null };

/**
 * Two callers, two credentials:
 * - cron (pg_net) sends `x-sync-secret`, read from the `sync_esb_shared_secret`
 *   vault secret -- a plain string, so nothing about it can expire or be
 *   re-validated by the gateway.
 * - the dashboard's sync buttons send a logged-in user's session JWT, which
 *   we verify ourselves now that the gateway no longer does.
 * Returns null when neither checks out.
 */
export async function identifyCaller(req: Request, client: SupabaseClient): Promise<Caller | null> {
  if (secretMatches(req.headers.get("x-sync-secret"))) return { via: "secret" };

  const header = req.headers.get("Authorization") ?? "";
  const token = /^bearer /i.test(header) ? header.slice(7).trim() : "";
  if (!token) return null;
  if (secretMatches(token)) return { via: "secret" };

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { via: "user", email: data.user.email ?? null };
}

export async function isAuthorized(req: Request, client: SupabaseClient): Promise<boolean> {
  return (await identifyCaller(req, client)) !== null;
}
