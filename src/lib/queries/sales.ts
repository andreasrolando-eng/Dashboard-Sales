import { createClient } from "@/lib/supabase/client";
import { isMockMode } from "@/lib/mock/is-mock";
import { mockMenuPerformance, mockSalesDailyOutlet, mockSalesHourlyOutlet, mockSalesProductDaily } from "@/lib/mock/queries";
import { resolveCategory, resolveOutlet } from "./helpers";

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
  category: string | null;
  qty: number;
  revenue: number;
}

function aggregateProducts(rows: { menu_id: string; menu_name: string | null; category: string | null; qty: number | null; revenue: number | null }[]): ProductAgg[] {
  const map = new Map<string, ProductAgg>();
  for (const r of rows) {
    const e = map.get(r.menu_id) ?? { menu_id: r.menu_id, menu_name: r.menu_name, category: r.category, qty: 0, revenue: 0 };
    e.qty += r.qty ?? 0;
    e.revenue += r.revenue ?? 0;
    map.set(r.menu_id, e);
  }
  return [...map.values()];
}

/** Aggregated per-product totals over the filtered range, respects outlet+category. */
export async function getProductAggregates(dateStart: string, dateEnd: string, outlet: string, category: string): Promise<ProductAgg[]> {
  const branch = resolveOutlet(outlet);
  const cat = resolveCategory(category);

  if (isMockMode()) return aggregateProducts(mockSalesProductDaily(dateStart, dateEnd, branch, cat));

  const supabase = createClient();
  let query = supabase
    .from("v_sales_product_daily")
    .select("*")
    .gte("sales_date", dateStart)
    .lte("sales_date", dateEnd);
  if (branch) query = query.eq("branch_code", branch);
  if (cat) query = query.eq("category", cat);

  const { data, error } = await query;
  if (error) throw error;
  return aggregateProducts(data);
}

export async function getMenuPerformance(
  dateStart: string,
  dateEnd: string,
  outlet: string,
  category: string,
  threshold: number
) {
  const branch = resolveOutlet(outlet);
  const cat = resolveCategory(category);

  if (isMockMode()) return mockMenuPerformance(dateStart, dateEnd, branch, cat, threshold);

  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_menu_performance", {
    p_date_start: dateStart,
    p_date_end: dateEnd,
    p_outlet: branch,
    p_category: cat,
    p_threshold: threshold,
  });
  if (error) throw error;
  return data;
}
