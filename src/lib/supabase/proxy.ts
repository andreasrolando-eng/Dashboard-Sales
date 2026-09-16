import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { mfaChallengePending } from "./mfa";
import { rememberMeExpired } from "./remember-me";

const PUBLIC_PATHS = ["/login"];

// Same double gate as src/lib/mock/is-mock.ts: lets the dashboard be reached
// with `npm run dev` + NEXT_PUBLIC_USE_MOCK_DATA=true and no real Supabase
// project (this build has none -- see plan "Known gaps"). Impossible in a
// real deploy since it also requires NODE_ENV !== "production".
const MOCK_AUTH_BYPASS = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

/**
 * Refreshes the Supabase auth session cookie on every request and redirects
 * unauthenticated visitors to /login. Called from src/proxy.ts (Next 16
 * renamed middleware.ts -> proxy.ts; NextRequest/NextResponse API itself is
 * unchanged). Per Next 16 guidance, this is defense-in-depth, not the only
 * auth check -- Server Actions re-verify the session themselves too, since a
 * proxy matcher gap would otherwise silently skip them.
 */
export async function updateSession(request: NextRequest) {
  if (MOCK_AUTH_BYPASS) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const isPublicPath = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  const {
    data: { user: rawUser },
  } = await supabase.auth.getUser();

  let user = rawUser;

  // "Remember me" was declined and the browser session it was scoped to has
  // ended (see rememberMeExpired()) -- the Supabase refresh-token cookie is
  // still technically valid, but treat this as logged out and revoke it.
  if (user && rememberMeExpired(request.cookies)) {
    await supabase.auth.signOut();
    user = null;

    if (!isPublicPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
      return redirectResponse;
    }
  }

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // A password-only (AAL1) session for a user who has TOTP enrolled is not
  // fully authenticated yet -- send it back to /login, which renders the
  // MFA challenge step (rather than the dashboard) for exactly this state.
  if (user && !isPublicPath && (await mfaChallengePending(supabase))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login" && !(await mfaChallengePending(supabase))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
