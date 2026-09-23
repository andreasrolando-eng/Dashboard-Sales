import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets, so the session cookie
     * stays fresh across normal navigation without re-running on every
     * image/font/etc. Also excludes api/mcp -- that route has its own
     * independent token-based auth (a query param, see its own file), not a
     * Supabase browser session, and must be reachable by remote MCP clients
     * (claude.ai) that never have one.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/mcp|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
