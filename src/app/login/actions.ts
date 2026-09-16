"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_ME_PREF_COOKIE, SESSION_MARKER_COOKIE } from "@/lib/supabase/remember-me";

export async function login(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  if (!email || !password) {
    return { error: "Email dan password wajib diisi." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email atau password salah." };
  }

  const cookieStore = await cookies();
  if (remember) {
    cookieStore.delete(REMEMBER_ME_PREF_COOKIE);
    cookieStore.delete(SESSION_MARKER_COOKIE);
  } else {
    const secure = process.env.NODE_ENV === "production";
    // Persistent flag recording the choice, paired with a true session
    // cookie (no maxAge) -- see rememberMeExpired() for why two cookies.
    cookieStore.set(REMEMBER_ME_PREF_COOKIE, "0", {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure,
      maxAge: 60 * 60 * 24 * 365,
    });
    cookieStore.set(SESSION_MARKER_COOKIE, "1", { path: "/", sameSite: "lax", httpOnly: true, secure });
  }

  // Redirect back to /login (not straight to /dashboard) so the page can
  // re-check the session's AAL server-side and decide whether this account
  // still needs an MFA challenge before /dashboard is reachable.
  redirect("/login");
}

export async function verifyMfaCode(_prevState: unknown, formData: FormData) {
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!factorId || !code) {
    return { error: "Kode wajib diisi." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

  if (error) {
    return { error: "Kode salah atau sudah kedaluwarsa." };
  }

  redirect("/dashboard");
}

export async function cancelMfaLogin() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
