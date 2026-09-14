import { createClient } from "@/lib/supabase/client";
import { isMockMode } from "@/lib/mock/is-mock";
import { mockSalesChannelDaily, mockSalesOpsDaily, mockSalesPaymentMethodDaily } from "@/lib/mock/queries";
import { resolveOutlet } from "./helpers";

export async function getSalesOpsDaily(dateStart: string, dateEnd: string, outlet: string) {
  const branch = resolveOutlet(outlet);
  if (isMockMode()) return mockSalesOpsDaily(dateStart, dateEnd, branch);

  const supabase = createClient();
  let query = supabase
    .from("v_sales_ops_daily")
    .select("*")
    .gte("sales_date", dateStart)
    .lte("sales_date", dateEnd);
  if (branch) query = query.eq("branch_code", branch);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getSalesChannelDaily(dateStart: string, dateEnd: string, outlet: string) {
  const branch = resolveOutlet(outlet);
  if (isMockMode()) return mockSalesChannelDaily(dateStart, dateEnd, branch);

  const supabase = createClient();
  let query = supabase
    .from("v_sales_channel_daily")
    .select("*")
    .gte("sales_date", dateStart)
    .lte("sales_date", dateEnd);
  if (branch) query = query.eq("branch_code", branch);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getSalesPaymentMethodDaily(dateStart: string, dateEnd: string, outlet: string) {
  const branch = resolveOutlet(outlet);
  if (isMockMode()) return mockSalesPaymentMethodDaily(dateStart, dateEnd, branch);

  const supabase = createClient();
  let query = supabase
    .from("v_sales_payment_method_daily")
    .select("*")
    .gte("sales_date", dateStart)
    .lte("sales_date", dateEnd);
  if (branch) query = query.eq("branch_code", branch);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
