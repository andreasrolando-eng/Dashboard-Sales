// Zero-cost job monitoring/alerting (FR-5, NFR "Rp0/bulan"): a free
// healthchecks.io check pings this URL on success and /fail on failure.
// healthchecks.io itself alerts if no ping arrives within the expected
// schedule. No-op if HEALTHCHECKS_PING_URL isn't configured.

const PING_URL = Deno.env.get("HEALTHCHECKS_PING_URL");

async function ping(suffix: string, body?: string) {
  if (!PING_URL) return;
  try {
    await fetch(`${PING_URL}${suffix}`, { method: "POST", body });
  } catch {
    // Monitoring must never fail the job itself.
  }
}

export const pingSuccess = (message: string) => ping("", message);
export const pingFailure = (message: string) => ping("/fail", message);
