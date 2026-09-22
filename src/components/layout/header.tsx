"use client";

import { useQuery } from "@tanstack/react-query";
import { useDashboardFilters, type TabKey } from "@/lib/use-dashboard-filters";
import { getLastSync } from "@/lib/queries/meta";
import { ManualSyncButton } from "./manual-sync-button";
import { FullReportExportButton } from "@/components/ui/full-report-export-button";

const TITLE_MAP: Record<TabKey, string> = {
  overview: "Overview",
  sales: "Analisa Sales",
  ops: "Analisa Operasional",
  membership: "Analisa Membership",
  marketing: "Marketing",
};

export function Header() {
  const { tab } = useDashboardFilters();
  const { data } = useQuery({ queryKey: ["last-sync"], queryFn: getLastSync });

  const lastSyncedLabel = data?.finished_at
    ? new Date(data.finished_at).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB"
    : "—";

  return (
    <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
      <div>
        <div className="text-2xl font-bold text-text">{TITLE_MAP[tab]}</div>
        <div className="text-[13px] text-text-secondary mt-1">Data terakhir diperbarui: {lastSyncedLabel}</div>
      </div>
      <div className="flex items-start gap-2.5">
        <FullReportExportButton />
        <ManualSyncButton />
      </div>
    </div>
  );
}
