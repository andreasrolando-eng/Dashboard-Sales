"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { firstOfMonthISO, todayLocalISO } from "@/lib/format";

export type TabKey = "overview" | "sales" | "ops" | "membership" | "marketing";

export const ALL_OUTLETS = "Semua Outlet";
export const ALL_CATEGORIES = "Semua Kategori";
export const ALL_CATEGORY_DETAILS = "Semua Kategori Detail";

export interface DashboardFilters {
  tab: TabKey;
  outlet: string;
  category: string;
  categoryDetail: string;
  dateStart: string;
  dateEnd: string;
}

/**
 * All dashboard state lives in the URL (FR-19, and README's "gunakan query
 * params/URL state supaya filter bisa di-share/refresh tanpa hilang"). Tabs
 * are not separate routes -- just a `tab` search param on one shell route.
 */
export function useDashboardFilters(): DashboardFilters & {
  setTab: (tab: TabKey) => void;
  setOutlet: (outlet: string) => void;
  setCategory: (category: string) => void;
  setCategoryDetail: (categoryDetail: string) => void;
  /** Sets category+categoryDetail together in one URL update -- use when changing category needs to reset an out-of-hierarchy categoryDetail, since two separate set calls in the same handler would race (both read the same stale searchParams). */
  setCategoryAndDetail: (category: string, categoryDetail: string) => void;
  setDateStart: (date: string) => void;
  setDateEnd: (date: string) => void;
  /** Sets dateStart+dateEnd together in one URL update -- use whenever both change at once (e.g. picking a range/preset), for the same stale-searchParams race setCategoryAndDetail avoids. */
  setDateRange: (dateStart: string, dateEnd: string) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const today = useMemo(() => todayLocalISO(), []);
  const defaultStart = useMemo(() => firstOfMonthISO(), []);

  const tab = (searchParams.get("tab") as TabKey) || "overview";
  const outlet = searchParams.get("outlet") || ALL_OUTLETS;
  const category = searchParams.get("category") || ALL_CATEGORIES;
  const categoryDetail = searchParams.get("categoryDetail") || ALL_CATEGORY_DETAILS;
  const dateStart = searchParams.get("from") || defaultStart;
  const dateEnd = searchParams.get("to") || today;

  const update = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return {
    tab,
    outlet,
    category,
    categoryDetail,
    dateStart,
    dateEnd,
    setTab: (t) => update({ tab: t }),
    setOutlet: (o) => update({ outlet: o }),
    setCategory: (c) => update({ category: c }),
    setCategoryDetail: (cd) => update({ categoryDetail: cd }),
    setCategoryAndDetail: (c, cd) => update({ category: c, categoryDetail: cd }),
    setDateStart: (d) => update({ from: d }),
    setDateEnd: (d) => update({ to: d }),
    setDateRange: (start, end) => update({ from: start, to: end }),
  };
}
