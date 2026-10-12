import { fetchWithRetry } from "./http.ts";

// ESB Core is a different host from the OMS/sales API and has no static
// token: every run logs in with a service account (POST /auth/login) and uses
// the returned accessToken. Credentials only ever live in Supabase secrets.
const BASE_URL = (Deno.env.get("ESB_CORE_BASE_URL") ?? "").replace(/\/+$/, "");
const USERNAME = Deno.env.get("ESB_CORE_USERNAME") ?? "";
const PASSWORD = Deno.env.get("ESB_CORE_PASSWORD") ?? "";

/** ESB Core response envelope. */
export interface EsbCoreBody<T> {
  status?: string;
  code?: string;
  message?: string;
  result?: T | null;
  errors?: { attribute?: string; code?: string; message?: string }[] | null;
}

/** Paged list payload used by ESB Core report endpoints. */
export interface EsbCorePage<T> {
  count?: number;
  data?: T[] | null;
  limit?: number;
  next?: string;
  page?: number;
}

// Sanity cap so a server that never empties `next` can't loop forever.
const MAX_PAGES = 500;

async function errorDetail(res: Response): Promise<string> {
  // Only ESB's own code/message/field names -- never echo request data.
  try {
    const err = (await res.json()) as EsbCoreBody<unknown>;
    const fields = (err.errors ?? []).map((e) => [e.attribute, e.code, e.message].filter(Boolean).join(" ")).join("; ");
    return [err.code, err.message, fields].filter(Boolean).join(" | ");
  } catch {
    return "";
  }
}

export class EsbCoreClient {
  private token: string | null = null;
  // Shared in-flight login, so concurrent requests that all hit a 401 at
  // once trigger a single re-login instead of one each.
  private loginInFlight: Promise<string> | null = null;

  static assertConfigured() {
    if (!BASE_URL || !USERNAME || !PASSWORD) {
      throw new Error("ESB_CORE_BASE_URL / ESB_CORE_USERNAME / ESB_CORE_PASSWORD are not configured");
    }
  }

  private async login(): Promise<string> {
    const res = await fetchWithRetry(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    if (!res.ok) {
      const detail = await errorDetail(res);
      throw new Error(`ESB Core login failed: ${res.status} ${res.statusText}${detail ? ` -- ${detail}` : ""}`);
    }
    const body = (await res.json()) as EsbCoreBody<{ accessToken?: string }>;
    const token = body?.result?.accessToken;
    if (!token) throw new Error("ESB Core login returned no accessToken");
    return token;
  }

  private async getToken(forceRefresh: boolean, staleToken: string | null): Promise<string> {
    // Only re-login if nobody else already replaced the token we saw fail.
    if (this.token && !(forceRefresh && this.token === staleToken)) return this.token;
    if (!this.loginInFlight) {
      this.loginInFlight = this.login().finally(() => {
        this.loginInFlight = null;
      });
    }
    this.token = await this.loginInFlight;
    return this.token;
  }

  /** Logs in up front so a bad credential fails the run before any real work starts. */
  async init() {
    await this.getToken(false, null);
  }

  /**
   * Authenticated GET of `{ESB_CORE_BASE_URL}{path}`. A 401 re-logs in once
   * and retries; 429/5xx/timeouts are retried by fetchWithRetry. Throws on any
   * other non-2xx or a body whose status isn't "ok".
   */
  async get<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));

    let token = await this.getToken(false, null);
    let res = await fetchWithRetry(url.toString(), { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (res.status === 401) {
      await res.body?.cancel();
      token = await this.getToken(true, token);
      res = await fetchWithRetry(url.toString(), { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    }
    if (!res.ok) {
      const detail = await errorDetail(res);
      throw new Error(`HTTP ${res.status} ${res.statusText}${detail ? ` -- ${detail}` : ""}`);
    }

    const body = (await res.json()) as EsbCoreBody<T>;
    if (body?.status !== "ok" || body.result == null) {
      throw new Error(`unexpected body (status=${body?.status ?? "?"}, code=${body?.code ?? "?"})`);
    }
    return body.result;
  }

  /** Walks every page of a paged report endpoint (follows `page` until `next` is empty). */
  async getAllPages<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T[]> {
    const rows: T[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await this.get<EsbCorePage<T>>(path, { ...query, page });
      if (!Array.isArray(result.data)) throw new Error(`${path}: page ${page} has no data array`);
      rows.push(...result.data);
      if (!result.next || result.data.length === 0) return rows;
    }
    throw new Error(`${path}: more than ${MAX_PAGES} pages`);
  }
}
