import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_ME_PREF_COOKIE, SESSION_MARKER_COOKIE } from "@/lib/supabase/remember-me";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const email = data.session.user.email ?? "";

  // No domain restriction -- exchangeCodeForSession() above already
  // auto-created a Supabase user for whatever Google account just
  // authenticated, which would make login self-service for anyone with a
  // Google account if this were the only check. fn_is_allowed_email
  // (supabase/migrations/20260917090000_google_sso_allowlist.sql) checks a
  // table that only an admin writes to, never the auth flow itself -- this
  // is the actual, sole access gate now.
  const { data: allowed } = await supabase.rpc("fn_is_allowed_email", { p_email: email });
  if (!allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_registered`);
  }

  const cookieStore = await cookies();
  const remember = cookieStore.get("oauth_remember")?.value !== "0";
  cookieStore.delete("oauth_remember");

  if (remember) {
    cookieStore.delete(REMEMBER_ME_PREF_COOKIE);
    cookieStore.delete(SESSION_MARKER_COOKIE);
  } else {
    const secure = process.env.NODE_ENV === "production";
    // Same two-cookie pattern as the old password login action -- see
    // rememberMeExpired() for why this can't just be a cookie Max-Age.
    cookieStore.set(REMEMBER_ME_PREF_COOKIE, "0", {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure,
      maxAge: 60 * 60 * 24 * 365,
    });
    cookieStore.set(SESSION_MARKER_COOKIE, "1", { path: "/", sameSite: "lax", httpOnly: true, secure });
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
