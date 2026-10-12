import { fetchWithRetry } from "./http.ts";
import type { BomLineRow, EsbBomLineRecord, EsbCoreBody } from "./types.ts";

// ESB Core is a different host from the OMS/sales API and has no static
// token: every run logs in with a service account (POST /auth/login) and uses
// the returned accessToken. Credentials only ever live in Supabase secrets.
const BASE_URL = (Deno.env.get("ESB_CORE_BASE_URL") ?? "").replace(/\/+$/, "");
const USERNAME = Deno.env.get("ESB_CORE_USERNAME") ?? "";
const PASSWORD = Deno.env.get("ESB_CORE_PASSWORD") ?? "";

export class EsbCoreClient {
  private token: string | null = null;
  // Shared in-flight login, so concurrent BOM fetches that all hit a 401 at
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
      // Surface only ESB's error code/message/field names -- never echo the
      // request or any token-bearing part of the response.
      let detail = "";
      try {
        const err = (await res.json()) as EsbCoreBody<unknown> & { errors?: { attribute?: string; code?: string; message?: string }[] | null };
        const fields = (err.errors ?? []).map((e) => [e.attribute, e.code, e.message].filter(Boolean).join(" ")).join("; ");
        detail = [err.code, err.message, fields].filter(Boolean).join(" | ");
      } catch {
        // non-JSON error body
      }
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

  /** Logs in up front so a bad credential fails the run before any BOM work starts. */
  async init() {
    await this.getToken(false, null);
  }

  /**
   * GET {ESB_CORE_BASE_URL}/product/bom/detail/{bomID}. A 401 re-logs in once
   * and retries; 429/5xx/timeouts are retried by fetchWithRetry. An empty or
   * malformed result is an error -- a BOM with an id but no lines is never
   * published as "costs nothing".
   */
  async fetchBomLines(bomId: number): Promise<BomLineRow[]> {
    const url = `${BASE_URL}/product/bom/detail/${encodeURIComponent(String(bomId))}`;

    let token = await this.getToken(false, null);
    let res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (res.status === 401) {
      await res.body?.cancel();
      token = await this.getToken(true, token);
      res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const body = (await res.json()) as EsbCoreBody<EsbBomLineRecord[]>;
    if (body?.status !== "ok" || !Array.isArray(body.result)) {
      throw new Error(`unexpected body (status=${body?.status ?? "?"}, code=${body?.code ?? "?"})`);
    }
    if (body.result.length === 0) throw new Error("BOM has no detail lines");

    // Keyed by line ID: the publish step's primary key is (date, bom, line).
    const byLine = new Map<number, BomLineRow>();
    for (const l of body.result) {
      if (l.ID == null) throw new Error("detail line without ID");
      byLine.set(l.ID, {
        bom_id: bomId,
        line_id: l.ID,
        product_id: l.productID ?? null,
        product_code: l.productCode ?? null,
        product_name: l.productName ?? null,
        qty: l.qty ?? null,
        uom_name: l.uomName ?? null,
        convertion_qty: l.convertionQty ?? null,
        yield_percent: l.yieldPercent ?? null,
        tolerance_percent: l.tolerancePercent ?? null,
        weight_factor: l.weightFactor ?? null,
        last_hpp: l.lastHpp ?? null,
        substitutions: Array.isArray(l.subtitution) ? l.subtitution : [],
      });
    }
    return [...byLine.values()];
  }
}
