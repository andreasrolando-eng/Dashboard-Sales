import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadConfig } from "../config.js";
import { createDb } from "../db.js";
import { buildAnalyticsMcpServer } from "../server.js";

const config = loadConfig();
const db = createDb(config.databaseUrl);

// serveStdio owns the transport; it calls this factory once to build the
// server instance that serves the connection. stdout is reserved for the
// JSON-RPC protocol -- never console.log here or anywhere this module imports.
void serveStdio(() => buildAnalyticsMcpServer(db));
console.error("[mcp-server] serving over stdio");
