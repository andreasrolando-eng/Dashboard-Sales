import { createClient } from "@/lib/supabase/client";
import { isMockMode } from "@/lib/mock/is-mock";
import { mockMembershipNewWeekly, mockMembershipSummary, mockTopMembers } from "@/lib/mock/queries";
import { resolveOutlet } from "./helpers";

export async function getMembershipSummary(dateStart: string, dateEnd: string, outlet: string) {
  const branch = resolveOutlet(outlet);
  if (isMockMode()) return mockMembershipSummary(dateStart, dateEnd, branch)[0];

  const supabase = createClient();
  const { data, error } = await supabase
    .rpc("fn_membership_summary", { p_date_start: dateStart, p_date_end: dateEnd, p_outlet: branch })
    .single();
  if (error) throw error;
  return data;
}

export async function getTopMembers(dateStart: string, dateEnd: string, outlet: string, limit = 8) {
  const branch = resolveOutlet(outlet);
  if (isMockMode()) return mockTopMembers(dateStart, dateEnd, branch, limit);

  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_top_members", {
    p_date_start: dateStart,
    p_date_end: dateEnd,
    p_outlet: branch,
    p_limit: limit,
  });
  if (error) throw error;
  return data;
}

/** Weekly new-member counts, windowed to the last 8 buckets ending at dateEnd. */
export async function getMembershipNewWeekly(dateEnd: string) {
  if (isMockMode()) return mockMembershipNewWeekly(dateEnd);

  const windowStart = new Date(dateEnd);
  windowStart.setDate(windowStart.getDate() - 7 * 8);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_membership_new_weekly")
    .select("*")
    .gte("week_start", windowStart.toISOString().slice(0, 10))
    .lte("week_start", dateEnd)
    .order("week_start");
  if (error) throw error;
  return data.slice(-8);
}
