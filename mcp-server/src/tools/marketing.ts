import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Db } from "../db.js";
import { dateRange } from "../lib/dates.js";
import { optionalOutlet } from "../lib/validation.js";
import { toResult } from "../lib/output.js";
import { withToolErrorHandling } from "../lib/errors.js";

export function registerMarketingTools(server: McpServer, db: Db) {
  server.registerTool(
    "promo_performance",
    {
      description: "Promo redemptions, lift vs. baseline, ROI, and effectiveness status for a date range. Direct passthrough of the dashboard's fn_promo_performance RPC.",
      inputSchema: dateRange.and(z.object({ outlet: optionalOutlet })),
    },
    withToolErrorHandling(async ({ dateStart, dateEnd, outlet }) => {
      const rows = await db`
        select * from fn_promo_performance(${dateStart}, ${dateEnd}, ${outlet ?? null})
      `;
      return toResult(`Promo performance for ${dateStart} to ${dateEnd}: ${rows.length} promo(s).`, rows);
    })
  );
}
