import postgres from "postgres";

export type Db = ReturnType<typeof postgres>;

/** One pooled connection, created once at process startup and shared across every tool call (and, for HTTP, across every per-request server factory invocation). Takes a bare connection string rather than the whole Config so it's equally usable from the Next.js /api/mcp route, which has no MCP_HTTP_HOST/PORT of its own. */
export function createDb(databaseUrl: string): Db {
  return postgres(databaseUrl, { max: 5 });
}
