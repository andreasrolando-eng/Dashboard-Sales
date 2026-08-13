import { createClient } from "@/lib/supabase/client";
import { isMockMode } from "@/lib/mock/is-mock";
import { mockPromoPerformance } from "@/lib/mock/queries";
import { resolveOutlet } from "./helpers";

export async function getPromoPerformance(dateStart: string, dateEnd: string, outlet: string) {
  const branch = resolveOutlet(outlet);
  if (isMockMode()) return mockPromoPerformance(dateStart, dateEnd, branch);

  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_promo_performance", {
    p_date_start: dateStart,
    p_date_end: dateEnd,
    p_outlet: branch,
  });
  if (error) throw error;
  return data;
}
