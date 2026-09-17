"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN;

export async function addUser(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const isAdmin = formData.get("isAdmin") === "on";

  if (!email || !email.includes("@")) {
    return { error: "Email tidak valid." };
  }
  if (ALLOWED_EMAIL_DOMAIN && !email.endsWith(`@${ALLOWED_EMAIL_DOMAIN.toLowerCase()}`)) {
    return { error: `Email harus pakai domain @${ALLOWED_EMAIL_DOMAIN}.` };
  }

  const supabase = await createClient();
  // fn_admin_add_user re-checks the caller's own admin status server-side
  // (supabase/migrations/20260917100000_admin_role.sql) -- this action isn't
  // the real gate, the database function is.
  const { error } = await supabase.rpc("fn_admin_add_user", { p_email: email, p_is_admin: isAdmin });

  if (error) {
    return { error: "Gagal menambahkan user. Coba lagi." };
  }

  revalidatePath("/admin/users");
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

  revalidatePath("/admin/users");
  return { success: true };
}
