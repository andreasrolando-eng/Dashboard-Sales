import type { EsbPagination, EsbSalesPage, EsbSalesRecord } from "./types.ts";

const BASE_URL = Deno.env.get("ESB_API_BASE_URL") ?? "";
const API_KEY = Deno.env.get("ESB_API_KEY") ?? "";

function parsePagination(headers: Headers): EsbPagination {
  return {
    totalCount: Number(headers.get("x-pagination-total-count") ?? 0),
    pageCount: Number(headers.get("x-pagination-page-count") ?? 1),
    currentPage: Number(headers.get("x-pagination-current-page") ?? 1),
    perPage: Number(headers.get("x-pagination-per-page") ?? 20),
  };
}

// Confirmed real endpoint: {ESB_API_BASE_URL}/corev1/sales/sales-information
// (e.g. https://stg7.esb.co.id/api-fnb-backend/web/corev1/sales/sales-information).
// Built via string concat, NOT `new URL(path, BASE_URL)` -- BASE_URL already
// has its own path (/api-fnb-backend/web), and a leading-slash relative path
// passed to the URL constructor replaces the base's whole path instead of
// appending to it, silently dropping that prefix.
//
// Confirmed request contract:
// - Auth: `Authorization: Bearer <token>`.
// - Date filter is a range (salesDateFrom/salesDateTo, yyyy-mm-dd) -- we pass
//   the same value for both since this fetches one day at a time.
// - Page size is fixed server-side at 20 (no perPage param exists).
// - No branchCode filter -- omitting it returns all branches in one pass,
//   cheaper than looping per outlet.
// - No statusName filter -- intentionally pulling New/Finished/Cancelled/Void
//   all together so raw_sales keeps full fidelity for audit; status-based
//   filtering (e.g. revenue = Finished only) happens downstream in the SQL
//   views, not here.
// - sortBy/sortOrder pinned so pagination order is stable across page
//   requests even if rows are being written concurrently.
async function fetchSalesPage(date: string, page: number): Promise<EsbSalesPage> {
  const url = new URL(`${BASE_URL.replace(/\/+$/, "")}/corev1/sales/sales-information`);
  url.searchParams.set("salesDateFrom", date);
  url.searchParams.set("salesDateTo", date);
  url.searchParams.set("page", String(page));
  url.searchParams.set("sortBy", "salesDateIn");
  url.searchParams.set("sortOrder", "asc");

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`ESB get-sales-information failed: ${res.status} ${res.statusText} (page ${page}, date ${date})`);
  }

  const records = (await res.json()) as EsbSalesRecord[];
  return { records, pagination: parsePagination(res.headers) };
}

/** Fetches every page of sales for a single date, looping until currentPage === pageCount. */
export async function fetchAllSalesForDate(date: string): Promise<EsbSalesRecord[]> {
  const first = await fetchSalesPage(date, 1);
  const all = [...first.records];

  let currentPage = first.pagination.currentPage || 1;
  const pageCount = first.pagination.pageCount || 1;

  while (currentPage < pageCount) {
    currentPage += 1;
    const next = await fetchSalesPage(date, currentPage);
    all.push(...next.records);
  }

  return all;
}
