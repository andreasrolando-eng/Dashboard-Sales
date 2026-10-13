import type { TabKey } from "@/lib/use-dashboard-filters";

export type NavIcon = "overview" | "sales" | "ops" | "membership" | "marketing" | "cost";

/**
 * The dashboard is sold per module: each module is one sidebar section with
 * its own tabs. Keep every tab inside exactly one module so per-customer
 * module access can later be enforced by filtering this list (and the matching
 * RPC grants), without touching the tabs themselves.
 */
export const MODULES: {
  key: "sales_analytics" | "cost_control";
  label: string;
  tabs: { key: TabKey; label: string; title: string; icon: NavIcon }[];
}[] = [
  {
    key: "sales_analytics",
    label: "Sales Analytics",
    tabs: [
      { key: "overview", label: "Overview", title: "Overview", icon: "overview" },
      { key: "sales", label: "Sales", title: "Analisa Sales", icon: "sales" },
      { key: "ops", label: "Operasional", title: "Analisa Operasional", icon: "ops" },
      { key: "membership", label: "Membership", title: "Analisa Membership", icon: "membership" },
      { key: "marketing", label: "Marketing", title: "Marketing", icon: "marketing" },
    ],
  },
  {
    key: "cost_control",
    label: "Cost Control",
    tabs: [{ key: "hpp", label: "HPP & COGS", title: "HPP & COGS", icon: "cost" }],
  },
];

export const TAB_TITLES = Object.fromEntries(
  MODULES.flatMap((m) => m.tabs.map((t) => [t.key, t.title]))
) as Record<TabKey, string>;
