export interface Config {
  databaseUrl: string;
  httpHost: string;
  httpPort: number;
}

/** Reads env vars already loaded by `node --env-file=.env` -- fails fast with a clear stderr message rather than connecting with an empty/undefined credential. */
export function loadConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[mcp-server] Missing DATABASE_URL. Copy .env.example to .env and fill it in (see README.md).");
    process.exit(1);
  }

  return {
    databaseUrl,
    httpHost: process.env.MCP_HTTP_HOST || "127.0.0.1",
    httpPort: Number(process.env.MCP_HTTP_PORT) || 3001,
  };
}
