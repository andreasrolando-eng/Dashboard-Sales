import { createServer } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler, localhostHostValidation, localhostOriginValidation } from "@modelcontextprotocol/node";
import { loadConfig } from "../config.js";
import { createDb } from "../db.js";
import { buildAnalyticsMcpServer } from "../server.js";

const config = loadConfig();
const db = createDb(config);

// createMcpHandler's factory runs once PER REQUEST -- stateless by design,
// no session lives on the handler between requests. Cheap here since it
// only registers tool closures over the shared `db` pool created above.
const mcpHandler = createMcpHandler(() => buildAnalyticsMcpServer(db));
const nodeHandler = toNodeHandler(mcpHandler);

const validateHost = localhostHostValidation();
const validateOrigin = localhostOriginValidation();

// Plain node:http has no middleware chain, so the Host/Origin guards are
// composed in front of the handler by hand -- same defaults the framework
// app factories (createMcpExpressApp/createMcpHonoApp) apply automatically.
// This server must stay bound to loopback; a real public deployment would
// need real authentication in front of it first (see README).
createServer(async (req, res) => {
  if (!validateHost(req, res) || !validateOrigin(req, res)) return;
  await nodeHandler(req, res);
}).listen(config.httpPort, config.httpHost, () => {
  console.error(`[mcp-server] listening on http://${config.httpHost}:${config.httpPort}/mcp`);
});
