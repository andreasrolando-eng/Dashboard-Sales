"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addUser(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const isAdmin = formData.get("isAdmin") === "on";

  if (!email || !email.includes("@")) {
    return { error: "Email tidak valid." };
  }

  const supabase = await createClient();
  // fn_admin_add_user re-checks the caller's own admin status server-side
  // (supabase/migrations/20260917100000_admin_role.sql) -- this action isn't
  // the real gate, the database function is. No domain restriction -- any
  // email an admin adds here can log in.
  const { error } = await supabase.rpc("fn_admin_add_user", { p_email: email, p_is_admin: isAdmin });

  if (error) {
    return { error: "Gagal menambahkan user. Coba lagi." };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

export async function removeUser(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  if (!email) {
    return { error: "Email tidak ditemukan." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_admin_remove_user", { p_email: email });

  if (error) {
    return { error: "Gagal menghapus user." };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}
