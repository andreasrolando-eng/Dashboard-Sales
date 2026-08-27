import { createClient } from "@/lib/supabase/client";
import { isMockMode } from "@/lib/mock/is-mock";
import { mockCategoryDetailOptions, mockCategoryOptions, mockLastSync, mockOutletOptions } from "@/lib/mock/queries";

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
