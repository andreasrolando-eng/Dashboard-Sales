import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_ME_PREF_COOKIE, SESSION_MARKER_COOKIE } from "@/lib/supabase/remember-me";

// Server-side allowlist -- the `hd` param on the Google OAuth request
// (google-signin-button.tsx) only narrows the account picker, it's
// client-controlled and not a security boundary. Anyone can authenticate
// with any Google account; this is the actual gate. No env var set = no
// restriction, so a misconfigured deploy fails open -- keep it set.
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN;

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
  if (ALLOWED_EMAIL_DOMAIN && !email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN.toLowerCase()}`)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain_not_allowed`);
  }

  // Domain match alone isn't enough -- exchangeCodeForSession() above already
  // auto-created a Supabase user for ANY @esb.co.id Google account, which
  // would make login self-service for the whole company. fn_is_allowed_email
  // (supabase/migrations/20260917090000_google_sso_allowlist.sql) checks a
  // table that only an admin writes to, never the auth flow itself.
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
