import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * True when the session is only AAL1 (password) but the user has a verified
 * TOTP factor that requires AAL2 -- i.e. the second-factor challenge is still
 * outstanding. Reads the already-fetched JWT claims, no extra network call.
 */
export async function mfaChallengePending(supabase: SupabaseClient<Database>): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data !== null && data.nextLevel === "aal2" && data.currentLevel !== data.nextLevel;
}
