import type { NextConfig } from "next";

const supabaseOrigin = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");

// Pragmatic first pass, not a strict nonce-based CSP: script-src/style-src keep
// 'unsafe-inline' because Next's App Router streams some inline hydration
// script tags and this app uses plenty of inline `style={{...}}` (KpiCard,
// ops-tab charts, etc.) -- tightening those needs a per-request nonce wired
// through src/proxy.ts, left for later. Everything else here is safe to be
// strict from day one.
//
// 'unsafe-eval' is dev-only: React's dev build uses eval() to reconstruct
// component stacks for better error messages (confirmed via a real CSP
// violation caught by the Playwright smoke tests against `next dev`) --
// "React will never use eval() in production mode" per React's own warning,
// so this never reaches a deployed build.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} https://*.supabase.co wss://*.supabase.co`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // The `postgres` client (used by the /api/mcp route to reach the
  // mcp_analytics role) talks raw TCP directly -- Next's bundler can't trace
  // that the way it does normal imports, so it has to stay an actual
  // require() at runtime instead of being bundled.
  serverExternalPackages: ["postgres"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
