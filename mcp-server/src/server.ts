import { McpServer } from "@modelcontextprotocol/server";
import type { Db } from "./db.js";
import { registerMetaTools } from "./tools/meta.js";
import { registerSalesTools } from "./tools/sales.js";
import { registerOpsTools } from "./tools/ops.js";
import { registerMembershipTools } from "./tools/membership.js";
import { registerMarketingTools } from "./tools/marketing.js";

/**
 * Transport-independent MCP server factory -- both stdio and Streamable
 * HTTP entrypoints call this to build the same tool set. Never import
 * anything transport-specific here.
 */
export function buildAnalyticsMcpServer(db: Db): McpServer {
  const server = new McpServer({ name: "esb-analytics", version: "1.0.0" });

  registerMetaTools(server, db);
  registerSalesTools(server, db);
  registerOpsTools(server, db);
  registerMembershipTools(server, db);
  registerMarketingTools(server, db);

  return server;
}
