import { createClient } from "@/lib/supabase/client";
import { isMockMode } from "@/lib/mock/is-mock";
import {
  mockMemberMenuPurchases,
  mockMemberOptions,
  mockMembershipNewWeekly,
  mockMembershipSummary,
  mockTopMembers,
} from "@/lib/mock/queries";
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

/** Member picker options for the menu-purchase report, scoped to outlet (via home_branch_code). */
export async function getMemberOptions(outlet: string) {
  const branch = resolveOutlet(outlet);
  if (isMockMode()) return mockMemberOptions(branch);

  const supabase = createClient();
  let query = supabase.from("v_members_dim").select("member_code, member_name").order("member_name");
  if (branch) query = query.eq("home_branch_code", branch);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Menu items a single member bought in the period ("member ini beli menu apa aja"), for the Membership tab report panel. */
export async function getMemberMenuPurchases(memberCode: string, dateStart: string, dateEnd: string, outlet: string) {
  const branch = resolveOutlet(outlet);
  if (isMockMode()) return mockMemberMenuPurchases(memberCode, dateStart, dateEnd, branch);

  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_member_menu_purchases", {
    p_member_code: memberCode,
    p_date_start: dateStart,
    p_date_end: dateEnd,
    p_outlet: branch,
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
