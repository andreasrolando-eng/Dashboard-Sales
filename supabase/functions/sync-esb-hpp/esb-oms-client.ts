import { fetchWithRetry } from "./http.ts";
import type { EsbGetMenuBody, EsbMenuRecord } from "./types.ts";

// Same host and static token as the sales sync (supabase/functions/sync-esb/esb-client.ts).
const BASE_URL = Deno.env.get("ESB_API_BASE_URL") ?? "";
const API_KEY = Deno.env.get("ESB_API_KEY") ?? "";

// Safety stop if ESB ever omits the pagination headers and keeps returning
// full pages -- never loop forever.
const MAX_PAGES = 1000;

/**
 * GET {ESB_API_BASE_URL}/corev1/master/get-menu?page=N
 *
 * Per ESB's docs the body is `{ result: { data: [...] } }` (unlike the sales
 * endpoint's bare array) and pagination comes from the same `x-pagination-*`
 * response headers. No active-flag param is sent, so ESB's default applies
 * (active menus only, per the docs) -- sales of a menu deactivated in ESB will
 * show as `unmapped` until that's confirmed otherwise (plan blocker B4).
 *
 * URL built by string concat, not `new URL(path, BASE_URL)`: BASE_URL has its
 * own path (/api-fnb-backend/web) which the URL constructor would drop.
 */
async function fetchMenuPage(page: number): Promise<{ records: EsbMenuRecord[]; pageCount: number | null; perPage: number | null }> {
  const url = new URL(`${BASE_URL.replace(/\/+$/, "")}/corev1/master/get-menu`);
  url.searchParams.set("page", String(page));

  const res = await fetchWithRetry(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`ESB get-menu failed: ${res.status} ${res.statusText} (page ${page})`);
  }

  const body = (await res.json()) as EsbGetMenuBody;
  const records = body?.result?.data;
  if (!Array.isArray(records)) {
    throw new Error(`ESB get-menu returned an unexpected body on page ${page} (no result.data array)`);
  }

  const pageCountHeader = res.headers.get("x-pagination-page-count");
  const perPageHeader = res.headers.get("x-pagination-per-page");
  return {
    records,
    pageCount: pageCountHeader ? Number(pageCountHeader) : null,
    perPage: perPageHeader ? Number(perPageHeader) : body.result?.limit ?? null,
  };
}

export async function fetchAllMenus(): Promise<EsbMenuRecord[]> {
  if (!BASE_URL || !API_KEY) throw new Error("ESB_API_BASE_URL / ESB_API_KEY are not configured");

  const first = await fetchMenuPage(1);
  const all = [...first.records];

  if (first.pageCount !== null) {
    for (let page = 2; page <= Math.min(first.pageCount, MAX_PAGES); page += 1) {
      all.push(...(await fetchMenuPage(page)).records);
    }
    return all;
  }

  // No page-count header: keep going while pages come back full.
  let last = first;
  for (let page = 2; page <= MAX_PAGES && last.perPage && last.records.length >= last.perPage; page += 1) {
    last = await fetchMenuPage(page);
    all.push(...last.records);
  }
  return all;
}
