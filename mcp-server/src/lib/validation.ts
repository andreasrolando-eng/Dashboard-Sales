import * as z from "zod/v4";

/** Omitted = all outlets (no "Semua Outlet" sentinel -- that's a dashboard UI artifact). Canonical value is branch_code, resolved via the list_outlets tool. */
export const optionalOutlet = z.string().min(1).describe("branch_code from list_outlets. Omit for all outlets.").optional();

export const optionalCategory = z.string().min(1).describe("category_id from list_categories. Omit for all categories.").optional();

export const optionalCategoryDetail = z
  .string()
  .min(1)
  .describe("category_detail_id from list_categories. Omit for all category details.")
  .optional();

/** Every list-shaped tool gets an explicit default and a hard max -- never unbounded. */
export function limitParam(defaultValue: number, max: number) {
  return z.number().int().positive().max(max).default(defaultValue);
}
