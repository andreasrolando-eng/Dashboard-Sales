import { createMcpHandler } from "@modelcontextprotocol/server";
// Imports mcp-server's BUILT output, not its TypeScript source -- Turbopack
// doesn't resolve the NodeNext-style `.js`-suffixed relative imports inside
// mcp-server's own source files (`./tools/meta.js` etc., required there so
// the compiled output runs correctly under plain Node ESM), so importing the
// pre-compiled dist/ sidesteps that entirely. Root's `npm run build` builds
// mcp-server first for exactly this reason (see package.json).
import { buildAnalyticsMcpServer } from "../../../../mcp-server/dist/server.js";
import { createDb } from "../../../../mcp-server/dist/db.js";

/**
 * Public Streamable HTTP entrypoint for the read-only analytics MCP server,
 * so claude.ai's Custom Connectors (and other remote MCP clients) can reach
 * it -- claude.ai only supports remote HTTPS MCP servers, never a local
 * stdio process (that's mcp-server/src/transports/stdio.ts, for Claude
 * Code/Desktop instead). Intentionally imports the sibling mcp-server/
 * package's source directly rather than duplicating the tool/server code,
 * so both entrypoints share one implementation.
 *
 * claude.ai's Custom Connector UI has no field for a manual bearer token
 * (only OAuth or fully-open) -- so auth here is a shared secret carried as
 * a URL query param (?key=...), checked before any MCP request is served.
 * Treat the full connector URL (including the key) as a secret: don't
 * paste it anywhere public.
 */

const databaseUrl = process.env.MCP_DATABASE_URL;
const authToken = process.env.MCP_AUTH_TOKEN;

// Module-level singleton -- reused across warm invocations of this
// serverless function, same one-pool-per-process pattern as the stdio/local
// HTTP transports. Built lazily so a missing env var surfaces as a clean
// 500 on first request instead of crashing the whole function at cold start.
let handler: ReturnType<typeof createMcpHandler> | undefined;

function getHandler() {
  if (!databaseUrl) throw new Error("MCP_DATABASE_URL is not configured");
  if (!handler) {
    const db = createDb(databaseUrl);
    handler = createMcpHandler(() => buildAnalyticsMcpServer(db));
  }
  return handler;
}

function isAuthorized(request: Request): boolean {
  if (!authToken) return false; // fail closed if the token itself isn't configured
  const key = new URL(request.url).searchParams.get("key");
  return key === authToken;
}

async function handle(request: Request): Promise<Response> {
  // 404, not 401/403 -- doesn't confirm to an unauthenticated prober that
  // an MCP endpoint even exists at this path.
  if (!isAuthorized(request)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    return await getHandler().fetch(request);
  } catch (err) {
    console.error("[api/mcp]", err instanceof Error ? err.message : err);
    return new Response("Internal error", { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
