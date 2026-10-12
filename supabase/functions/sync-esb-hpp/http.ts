const REQUEST_TIMEOUT_MS = 20_000;
const BACKOFF_MS = [1_000, 2_000, 4_000];
const MAX_RETRY_AFTER_MS = 10_000;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch() with a per-attempt timeout and up to 3 retries (1s, 2s, 4s, or the
 * server's Retry-After when sent) on network errors, timeouts, 429 and 5xx.
 * Any other status is returned to the caller untouched -- 401 handling is the
 * caller's job because only it knows how to re-authenticate.
 */
export async function fetchWithRetry(url: string, init: RequestInit = {}): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt += 1) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!isRetryableStatus(res.status) || attempt === BACKOFF_MS.length) return res;
      const retryAfter = Number(res.headers.get("retry-after"));
      await res.body?.cancel();
      await sleep(retryAfter > 0 ? Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS) : BACKOFF_MS[attempt]);
    } catch (err) {
      lastError = err;
      if (attempt === BACKOFF_MS.length) break;
      await sleep(BACKOFF_MS[attempt]);
    }
  }
  throw new Error(`request failed after retries: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

/** Runs `worker` over `items` with at most `limit` in flight; never rejects (results carry their own errors). */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
