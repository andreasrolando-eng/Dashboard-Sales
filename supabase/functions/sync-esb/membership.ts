import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Member-profile sync (tier/join_date/status from a dedicated ESB
// membership endpoint) is intentionally feature-flagged OFF: no real
// endpoint sample/contract was available when this was built (see plan
// "Known gaps"). Membership *analytics* don't depend on this -- they're
// derived from memberCode/memberName already present on sales records (see
// v_members_dim in the membership_views migration), which has a
// spending-bracket fallback for tier in the meantime.
//
// To activate once the real endpoint is confirmed: set
// ESB_MEMBERSHIP_ENDPOINT, then implement fetch+transform+upsert here
// following the same pattern as esb-client.ts/transform.ts/upsert.ts, and
// call syncMembership(client) from index.ts.
export async function syncMembership(_client: SupabaseClient): Promise<{ ran: boolean; rows: number }> {
  const endpoint = Deno.env.get("ESB_MEMBERSHIP_ENDPOINT");
  if (!endpoint) {
    return { ran: false, rows: 0 };
  }

  throw new Error(
    "ESB_MEMBERSHIP_ENDPOINT is set but syncMembership() is not implemented -- " +
      "no real membership endpoint response sample was available to build the mapping against."
  );
}
