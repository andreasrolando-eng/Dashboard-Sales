import { createClient } from "@/lib/supabase/client";
import { isMockMode } from "@/lib/mock/is-mock";
import { mockCategoryDetailOptions, mockCategoryOptions, mockIsAdmin, mockLastSync, mockOutletOptions } from "@/lib/mock/queries";

export async function getOutletOptions() {
  if (isMockMode()) return mockOutletOptions();
  const supabase = createClient();
  const { data, error } = await supabase.from("v_outlets").select("*").order("branch_name");
  if (error) throw error;
  return data;
}

export async function getCategoryOptions() {
  if (isMockMode()) return mockCategoryOptions();
  const supabase = createClient();
  const { data, error } = await supabase.from("v_categories").select("*").order("category_name");
  if (error) throw error;
  return data;
}

export async function getCategoryDetailOptions() {
  if (isMockMode()) return mockCategoryDetailOptions();
  const supabase = createClient();
  const { data, error } = await supabase.from("v_category_details").select("*").order("category_detail_name");
  if (error) throw error;
  return data;
}

export async function getLastSync() {
  if (isMockMode()) return mockLastSync();
  const supabase = createClient();
  const { data, error } = await supabase.from("v_last_sync").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

/** Whether the logged-in user is an admin (allowed_users.is_admin). */
export async function getIsAdmin() {
  if (isMockMode()) return mockIsAdmin();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_is_admin_email");
  if (error) throw error;
  return data ?? false;
}
