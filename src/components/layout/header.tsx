"use client";

import { useQuery } from "@tanstack/react-query";
import { useDashboardFilters } from "@/lib/use-dashboard-filters";
import { TAB_TITLES } from "@/lib/modules";
import { getLastSync } from "@/lib/queries/meta";
import { ManualSyncButton } from "./manual-sync-button";
import { FullReportExportButton } from "@/components/ui/full-report-export-button";


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
        <div className="text-2xl font-bold text-text">{TAB_TITLES[tab]}</div>
        <div className="text-[13px] text-text-secondary mt-1">Data terakhir diperbarui: {lastSyncedLabel}</div>
      </div>
      <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-start">
        <FullReportExportButton />
        <ManualSyncButton />
      </div>
    </div>
  );
}
