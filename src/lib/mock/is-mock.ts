/**
 * Dev-only fixture data path so the UI can be visually verified against the
 * design screenshots without a live Supabase project (see plan "Known
 * gaps" -- no project access at build time). Cannot activate in a real
 * deploy: gated on NODE_ENV as well as the explicit opt-in flag.
 */
export function isMockMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
}
