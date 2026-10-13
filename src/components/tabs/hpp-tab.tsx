"use client";

import { useQuery } from "@tanstack/react-query";
import { useDashboardFilters } from "@/lib/use-dashboard-filters";
import { getMenuHpp } from "@/lib/queries/sales";
import { fmtNum, fmtRupiah } from "@/lib/format";
import { KpiCard } from "@/components/ui/kpi-card";
import { MenuHppPanel } from "./menu-hpp-panel";
import { IngredientUsagePanel } from "./ingredient-usage-panel";

/**
 * Cost Control module: HPP & COGS per menu and raw-material usage. The KPI
 * row reads the same ["menu-hpp", ...] query as MenuHppPanel, so the data is
 * fetched once for both.
 */
export function HppTab() {
  const { outlet, category, categoryDetail, dateStart, dateEnd } = useDashboardFilters();

  const hppQuery = useQuery({
    queryKey: ["menu-hpp", outlet, category, categoryDetail, dateStart, dateEnd],
    queryFn: () => getMenuHpp(dateStart, dateEnd, outlet, category, categoryDetail),
  });

  if (hppQuery.isLoading) {
    return <div className="text-sm text-text-secondary">Memuat data...</div>;
  }

  const rows = hppQuery.data ?? [];
  const cogsActual = rows.reduce((a, r) => a + r.cogs_actual, 0);
  const cogsEstimate = rows.reduce((a, r) => a + r.cogs_estimate, 0);
  const totalQty = rows.reduce((a, r) => a + r.qty, 0);
  const uncostedQty = rows.reduce((a, r) => a + r.uncosted_qty, 0);
  const completeMenus = rows.filter((r) => r.cost_coverage_status === "complete").length;
  const muted = "var(--color-text-tertiary)";

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-4 lg:gap-5">
        <KpiCard label="COGS Aktual (ESB)" value={fmtRupiah(cogsActual)} delta="Bulan yang sudah tutup" deltaColor={muted} />
        <KpiCard label="COGS Estimasi (BOM)" value={fmtRupiah(cogsEstimate)} delta="Bulan berjalan, belum final" deltaColor={muted} />
        <KpiCard
          label="Menu dengan HPP Lengkap"
          value={`${fmtNum(completeMenus)} / ${fmtNum(rows.length)}`}
          delta="Menu terjual di periode ini"
          deltaColor={muted}
        />
        <KpiCard
          label="Qty Tanpa HPP"
          value={fmtNum(uncostedQty)}
          delta={totalQty > 0 ? `${((uncostedQty / totalQty) * 100).toFixed(1)}% dari ${fmtNum(totalQty)} porsi` : "—"}
          deltaColor={uncostedQty > 0 ? "oklch(48% 0.12 70)" : muted}
        />
      </div>

      <MenuHppPanel outlet={outlet} category={category} categoryDetail={categoryDetail} dateStart={dateStart} dateEnd={dateEnd} />

      <IngredientUsagePanel outlet={outlet} category={category} categoryDetail={categoryDetail} dateStart={dateStart} dateEnd={dateEnd} />
    </>
  );
}
