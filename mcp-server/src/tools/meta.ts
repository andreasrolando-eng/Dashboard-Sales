import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Db } from "../db.js";
import { limitParam } from "../lib/validation.js";
import { toResult } from "../lib/output.js";
import { withToolErrorHandling } from "../lib/errors.js";

export function registerMetaTools(server: McpServer, db: Db) {
  server.registerTool(
    "list_outlets",
    {
      description:
        "Lists outlets (branch_code + branch_name). Call this first to resolve a human outlet name into the branch_code every other tool's `outlet` param expects.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Optional case-insensitive substring match on branch name/code.").optional(),
        limit: limitParam(20, 100),
      }),
    },
    withToolErrorHandling(async ({ query, limit }) => {
      const rows = await db`
        select branch_code, branch_name
        from v_outlets
        where (${query ?? null}::text is null or branch_name ilike '%' || ${query ?? null} || '%' or branch_code ilike '%' || ${query ?? null} || '%')
        order by branch_name
        limit ${limit}
      `;
      return toResult(`Found ${rows.length} outlet(s).`, rows);
    })
  );

  server.registerTool(
    "list_categories",
    {
      description:
        "Lists product categories with their category_details nested underneath. Call this first to resolve human category names into the category_id/category_detail_id that top_products/menu_performance expect.",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe("Optional case-insensitive substring match on category or category-detail name.")
          .optional(),
        limit: limitParam(20, 100).describe("Max number of top-level categories returned (their category_details are not separately limited)."),
      }),
    },
    withToolErrorHandling(async ({ query, limit }) => {
      const rows = await db`
        with matched_categories as (
          select category_id, category_name
          from v_categories
          where (${query ?? null}::text is null or category_name ilike '%' || ${query ?? null} || '%')
          order by category_name
          limit ${limit}
        )
        select mc.category_id, mc.category_name, cd.category_detail_id, cd.category_detail_name
        from matched_categories mc
        left join v_category_details cd on cd.category_id = mc.category_id
        order by mc.category_name, cd.category_detail_name
      `;

      interface CategoryGroup {
        category_id: string;
        category_name: string;
        category_details: { category_detail_id: string; category_detail_name: string }[];
      }
      const byCategory = new Map<string, CategoryGroup>();
      for (const r of rows) {
        const entry: CategoryGroup = byCategory.get(r.category_id) ?? { category_id: r.category_id, category_name: r.category_name, category_details: [] };
        if (r.category_detail_id) entry.category_details.push({ category_detail_id: r.category_detail_id, category_detail_name: r.category_detail_name });
        byCategory.set(r.category_id, entry);
      }
      const categories = [...byCategory.values()];
      return toResult(`Found ${categories.length} categor${categories.length === 1 ? "y" : "ies"}.`, categories);
    })
  );
}
