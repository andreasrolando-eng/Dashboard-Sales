import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Db } from "../db.js";
import { dateRange } from "../lib/dates.js";
import { optionalOutlet, optionalCategory, optionalCategoryDetail, limitParam } from "../lib/validation.js";
import { toResult } from "../lib/output.js";
import { withToolErrorHandling } from "../lib/errors.js";

export function registerSalesTools(server: McpServer, db: Db) {
  server.registerTool(
    "sales_summary",
    {
      description: "Total revenue/nett sales/transactions/member revenue for a date range, optionally scoped to one outlet. Mirrors the dashboard's sumSalesDaily().",
      inputSchema: dateRange.and(z.object({ outlet: optionalOutlet })),
    },
    withToolErrorHandling(async ({ dateStart, dateEnd, outlet }) => {
      const [row] = await db`
        select
          coalesce(sum(revenue), 0) as revenue,
          coalesce(sum(nett_sales), 0) as nett_sales,
          coalesce(sum(trans_count), 0) as trans_count,
          coalesce(sum(member_revenue), 0) as member_revenue
        from v_sales_daily_outlet
        where sales_date between ${dateStart} and ${dateEnd}
          and (${outlet ?? null}::text is null or branch_code = ${outlet ?? null})
      `;
      return toResult(`Sales summary for ${dateStart} to ${dateEnd}${outlet ? ` (outlet ${outlet})` : ""}.`, row);
    })
  );

  server.registerTool(
    "revenue_by_outlet",
    {
      description: "Cross-outlet revenue breakdown for a date range, ranked highest first. Always covers every outlet (there's no `outlet` filter -- that's the point of this tool). Mirrors groupRevenueByOutlet().",
      inputSchema: dateRange.and(z.object({ limit: limitParam(20, 100) })),
    },
    withToolErrorHandling(async ({ dateStart, dateEnd, limit }) => {
      const rows = await db`
        select o.branch_code, o.branch_name, coalesce(sum(v.revenue), 0) as revenue
        from v_outlets o
        left join v_sales_daily_outlet v
          on v.branch_code = o.branch_code
          and v.sales_date between ${dateStart} and ${dateEnd}
        group by o.branch_code, o.branch_name
        order by revenue desc
        limit ${limit}
      `;
      return toResult(`Revenue by outlet for ${dateStart} to ${dateEnd}, top ${rows.length}.`, rows);
    })
  );

  server.registerTool(
    "top_products",
    {
      description: "Aggregated per-product qty/revenue for a date range, sorted and limited. Mirrors the dashboard's product aggregation (Top Seller / Slow Moving).",
      inputSchema: dateRange.and(
        z.object({
          outlet: optionalOutlet,
          category: optionalCategory,
          categoryDetail: optionalCategoryDetail,
          limit: limitParam(20, 100),
          sortBy: z.enum(["qty", "revenue"]).default("revenue"),
        })
      ),
    },
    withToolErrorHandling(async ({ dateStart, dateEnd, outlet, category, categoryDetail, limit, sortBy }) => {
      const orderCol = sortBy === "qty" ? db`qty` : db`revenue`;
      const rows = await db`
        select menu_id, menu_name, category, category_detail,
          coalesce(sum(qty), 0) as qty,
          coalesce(sum(revenue), 0) as revenue
        from v_sales_product_daily
        where sales_date between ${dateStart} and ${dateEnd}
          and (${outlet ?? null}::text is null or branch_code = ${outlet ?? null})
          and (${category ?? null}::text is null or category_id = ${category ?? null})
          and (${categoryDetail ?? null}::text is null or category_detail_id = ${categoryDetail ?? null})
        group by menu_id, menu_name, category, category_detail
        order by ${orderCol} desc
        limit ${limit}
      `;
      return toResult(`Top ${rows.length} product(s) by ${sortBy} for ${dateStart} to ${dateEnd}.`, rows);
    })
  );

  server.registerTool(
    "menu_performance",
    {
      description: "Menu performance vs. the prior equal-length period, with a takeout-candidate flag below `threshold` units sold. Direct passthrough of the dashboard's fn_menu_performance RPC.",
      inputSchema: dateRange.and(
        z.object({
          outlet: optionalOutlet,
          category: optionalCategory,
          categoryDetail: optionalCategoryDetail,
          threshold: z.number().positive().default(300).describe("Units-sold threshold below which a menu is flagged is_takeout_candidate."),
        })
      ),
    },
    withToolErrorHandling(async ({ dateStart, dateEnd, outlet, category, categoryDetail, threshold }) => {
      const rows = await db`
        select * from fn_menu_performance(${dateStart}, ${dateEnd}, ${outlet ?? null}, ${category ?? null}, ${categoryDetail ?? null}, ${threshold})
      `;
      return toResult(`Menu performance for ${dateStart} to ${dateEnd}: ${rows.length} menu item(s).`, rows);
    })
  );
}
