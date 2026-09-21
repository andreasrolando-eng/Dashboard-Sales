import { createClient } from "@/lib/supabase/client";
import { isMockMode } from "@/lib/mock/is-mock";
import {
  mockMenuPerformance,
  mockSalesBills,
  mockSalesDailyOutlet,
  mockSalesDailyOutletCategory,
  mockSalesHourlyOutlet,
  mockSalesProductDaily,
} from "@/lib/mock/queries";
import { resolveCategory, resolveCategoryDetail, resolveOutlet } from "./helpers";

export async function getSalesDailyOutlet(dateStart: string, dateEnd: string, outlet: string) {
  const branch = resolveOutlet(outlet);
  if (isMockMode()) return mockSalesDailyOutlet(dateStart, dateEnd, branch);

  const supabase = createClient();
  let query = supabase
    .from("v_sales_daily_outlet")
    .select("*")
    .gte("sales_date", dateStart)
    .lte("sales_date", dateEnd);
  if (branch) query = query.eq("branch_code", branch);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getSalesHourlyOutlet(dateStart: string, dateEnd: string, outlet: string) {
  const branch = resolveOutlet(outlet);
  if (isMockMode()) return mockSalesHourlyOutlet(dateStart, dateEnd, branch);

  const supabase = createClient();
  let query = supabase
    .from("v_sales_hourly_outlet")
    .select("*")
    .gte("sales_date", dateStart)
    .lte("sales_date", dateEnd);
  if (branch) query = query.eq("branch_code", branch);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export interface ProductAgg {
  menu_id: string;
  menu_name: string | null;
  category_id: string | null;
  category: string | null;
  category_detail_id: string | null;
  category_detail: string | null;
  qty: number;
  revenue: number;
}

function aggregateProducts(
  rows: {
    menu_id: string;
    menu_name: string | null;
    category_id: string | null;
    category: string | null;
    category_detail_id: string | null;
    category_detail: string | null;
    qty: number | null;
    revenue: number | null;
  }[]
): ProductAgg[] {
  const map = new Map<string, ProductAgg>();
  for (const r of rows) {
    const e =
      map.get(r.menu_id) ??
      {
        menu_id: r.menu_id,
        menu_name: r.menu_name,
        category_id: r.category_id,
        category: r.category,
        category_detail_id: r.category_detail_id,
        category_detail: r.category_detail,
        qty: 0,
        revenue: 0,
      };
    e.qty += r.qty ?? 0;
    e.revenue += r.revenue ?? 0;
    map.set(r.menu_id, e);
  }
  return [...map.values()];
}

/** Aggregated per-product totals over the filtered range, respects outlet+category+categoryDetail (category/categoryDetail filter by menuCategoryID/menuCategoryDetailID, not name). */
export async function getProductAggregates(
  dateStart: string,
  dateEnd: string,
  outlet: string,
  category: string,
  categoryDetail: string
): Promise<ProductAgg[]> {
  const branch = resolveOutlet(outlet);
  const catId = resolveCategory(category);
  const catDetailId = resolveCategoryDetail(categoryDetail);

  if (isMockMode()) return aggregateProducts(mockSalesProductDaily(dateStart, dateEnd, branch, catId, catDetailId));

  const supabase = createClient();
  let query = supabase
    .from("v_sales_product_daily")
    .select("*")
    .gte("sales_date", dateStart)
    .lte("sales_date", dateEnd);
  if (branch) query = query.eq("branch_code", branch);
  if (catId) query = query.eq("category_id", catId);
  if (catDetailId) query = query.eq("category_detail_id", catDetailId);

  const { data, error } = await query;
  if (error) throw error;
  return aggregateProducts(data);
}

export interface CategoryRevenue {
  revenue: number;
  nett_sales: number;
}

function sumCategoryRevenue(rows: { revenue: number | null; nett_sales: number | null }[]): CategoryRevenue {
  return rows.reduce<CategoryRevenue>(
    (acc, r) => ({ revenue: acc.revenue + (r.revenue ?? 0), nett_sales: acc.nett_sales + (r.nett_sales ?? 0) }),
    { revenue: 0, nett_sales: 0 }
  );
}

/**
 * Revenue/nett_sales for the Sales tab's top KPI cards, scoped to
 * outlet+category+categoryDetail (unlike getSalesDailyOutlet, which has no
 * category dimension -- see v_sales_daily_outlet_category migration notes
 * for why nett_sales here is a proportional allocation, not exact).
 */
export async function getSalesRevenueByCategory(
  dateStart: string,
  dateEnd: string,
  outlet: string,
  category: string,
  categoryDetail: string
): Promise<CategoryRevenue> {
  const branch = resolveOutlet(outlet);
  const catId = resolveCategory(category);
  const catDetailId = resolveCategoryDetail(categoryDetail);

  if (isMockMode())
    return sumCategoryRevenue(mockSalesDailyOutletCategory(dateStart, dateEnd, branch, catId, catDetailId));

  const supabase = createClient();
  let query = supabase
    .from("v_sales_daily_outlet_category")
    .select("revenue, nett_sales")
    .gte("sales_date", dateStart)
    .lte("sales_date", dateEnd);
  if (branch) query = query.eq("branch_code", branch);
  if (catId) query = query.eq("category_id", catId);
  if (catDetailId) query = query.eq("category_detail_id", catDetailId);

  const { data, error } = await query;
  if (error) throw error;
  return sumCategoryRevenue(data);
}

export interface SalesBill {
  bill_num: string;
  sales_date: string;
  branch_code: string;
  grand_total: number;
}

function toSalesBills(
  rows: { bill_num: string; sales_date: string; branch_code: string; grand_total: number | null }[]
): SalesBill[] {
  return rows.map((r) => ({ ...r, grand_total: r.grand_total ?? 0 }));
}

/**
 * Bill-level list for the Sales tab's transaction drill-down panel --
 * server-side paginated (unlike every other function in this file, which
 * fetches its whole result set) since a month across "Semua Outlet" can run
 * into the thousands of bills, well past PostgREST's max_rows=1000 cap.
 * Sorted sales_date asc, bill_num asc -- see v_sales_bills migration notes
 * for why bill_num alone isn't a chronological sort across outlets.
 */
export async function getSalesBills(
  dateStart: string,
  dateEnd: string,
  outlet: string,
  page: number,
  pageSize: number
): Promise<{ rows: SalesBill[]; totalCount: number }> {
  const branch = resolveOutlet(outlet);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (isMockMode()) return mockSalesBills(dateStart, dateEnd, branch, page, pageSize);

  const supabase = createClient();
  let query = supabase
    .from("v_sales_bills")
    .select("bill_num, sales_date, branch_code, grand_total", { count: "exact" })
    .gte("sales_date", dateStart)
    .lte("sales_date", dateEnd)
    .order("sales_date", { ascending: true })
    .order("bill_num", { ascending: true })
    .range(from, to);
  if (branch) query = query.eq("branch_code", branch);

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    rows: toSalesBills(data ?? []),
    totalCount: count ?? 0,
  };
}

/**
 * Fetches every bill for the filter scope, not just one page -- for the
 * export buttons, which need the full result set even though the panel
 * itself only ever holds one page (up to 200 rows) in memory. Reuses
 * getSalesBills as the chunk fetcher (chunkSize doubles as its pageSize),
 * so mock mode and the sort order stay identical to the on-screen list.
 */
export async function getAllSalesBillsForExport(
  dateStart: string,
  dateEnd: string,
  outlet: string,
  onProgress?: (fetched: number, total: number) => void,
  chunkSize = 1000
): Promise<SalesBill[]> {
  const all: SalesBill[] = [];
  let page = 1;
  let totalCount = Infinity;

  while (all.length < totalCount) {
    const { rows, totalCount: total } = await getSalesBills(dateStart, dateEnd, outlet, page, chunkSize);
    totalCount = total;
    all.push(...rows);
    onProgress?.(all.length, totalCount);
    if (rows.length === 0) break; // guards against an infinite loop if totalCount is ever wrong
    page += 1;
  }

  return all;
}

export async function getMenuPerformance(
  dateStart: string,
  dateEnd: string,
  outlet: string,
  category: string,
  categoryDetail: string,
  threshold: number
) {
  const branch = resolveOutlet(outlet);
  const catId = resolveCategory(category);
  const catDetailId = resolveCategoryDetail(categoryDetail);

  if (isMockMode()) return mockMenuPerformance(dateStart, dateEnd, branch, catId, catDetailId, threshold);

  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_menu_performance", {
    p_date_start: dateStart,
    p_date_end: dateEnd,
    p_outlet: branch,
    p_category_id: catId,
    p_category_detail_id: catDetailId,
    p_threshold: threshold,
  });
  if (error) throw error;
  return data;
}
