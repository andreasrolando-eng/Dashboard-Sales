import { ALL_CATEGORIES, ALL_CATEGORY_DETAILS, ALL_OUTLETS } from "@/lib/use-dashboard-filters";

export const resolveOutlet = (outlet: string): string | null => (outlet === ALL_OUTLETS ? null : outlet);
export const resolveCategory = (category: string): string | null => (category === ALL_CATEGORIES ? null : category);
export const resolveCategoryDetail = (categoryDetail: string): string | null =>
  categoryDetail === ALL_CATEGORY_DETAILS ? null : categoryDetail;
