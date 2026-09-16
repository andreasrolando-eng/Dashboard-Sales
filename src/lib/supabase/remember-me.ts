export const REMEMBER_ME_PREF_COOKIE = "remember_me";
export const SESSION_MARKER_COOKIE = "session_active";

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/**
 * True when the user declined "remember me" at login and the browser
 * session that opt-out was scoped to has since ended.
 *
 * `@supabase/ssr` always writes its own session cookie with a fixed
 * ~400-day Max-Age (see DEFAULT_COOKIE_OPTIONS in the installed
 * @supabase/ssr -- it overrides any custom `cookieOptions.maxAge` on every
 * write), so there's no way to make *that* cookie itself expire when the
 * browser closes. "Remember me" is enforced instead as an independent
 * app-level gate: `SESSION_MARKER_COOKIE` is set with no Max-Age (a true
 * browser-session cookie) alongside the persistent `REMEMBER_ME_PREF_COOKIE`
 * flag. Once the marker is gone but the preference still says "declined",
 * the browser session has ended even though the Supabase refresh-token
 * cookie is technically still valid.
 */
export function rememberMeExpired(cookies: CookieReader): boolean {
  const declinedRemember = cookies.get(REMEMBER_ME_PREF_COOKIE)?.value === "0";
  if (!declinedRemember) return false;
  return cookies.get(SESSION_MARKER_COOKIE) === undefined;
}
