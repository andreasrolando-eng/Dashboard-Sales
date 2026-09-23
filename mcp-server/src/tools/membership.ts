import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Db } from "../db.js";
import { dateRange } from "../lib/dates.js";
import { optionalOutlet, limitParam } from "../lib/validation.js";
import { toResult } from "../lib/output.js";
import { withToolErrorHandling } from "../lib/errors.js";

export function registerMembershipTools(server: McpServer, db: Db) {
  server.registerTool(
    "membership_summary",
    {
      description: "Total/active members, churn/retention rates, and visit frequency for a date range. Calls the mcp_private.mcp_membership_summary DB wrapper (see mcp-server README) rather than the dashboard's RPC directly.",
      inputSchema: dateRange.and(z.object({ outlet: optionalOutlet })),
    },
    withToolErrorHandling(async ({ dateStart, dateEnd, outlet }) => {
      const [row] = await db`
        select * from mcp_private.mcp_membership_summary(${dateStart}, ${dateEnd}, ${outlet ?? null})
      `;
      return toResult(`Membership summary for ${dateStart} to ${dateEnd}${outlet ? ` (outlet ${outlet})` : ""}.`, row);
    })
  );

  server.registerTool(
    "top_members",
    {
      description:
        "Top members by spending for a date range. Calls the mcp_private.mcp_top_members DB wrapper, which intentionally omits member_name (data minimization) -- results identify members only by member_code, not by name.",
      inputSchema: dateRange.and(z.object({ outlet: optionalOutlet, limit: limitParam(8, 100) })),
    },
    withToolErrorHandling(async ({ dateStart, dateEnd, outlet, limit }) => {
      const rows = await db`
        select * from mcp_private.mcp_top_members(${dateStart}, ${dateEnd}, ${outlet ?? null}, ${limit})
      `;
      return toResult(`Top ${rows.length} member(s) by spending for ${dateStart} to ${dateEnd}.`, rows);
    })
  );
}
