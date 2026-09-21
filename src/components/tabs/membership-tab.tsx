"use client";

import { useQuery } from "@tanstack/react-query";
import { useDashboardFilters } from "@/lib/use-dashboard-filters";
import { getMembershipNewWeekly, getMembershipSummary, getTopMembers } from "@/lib/queries/membership";
import { getPreviousPeriod, pctDelta, deltaLabel } from "@/lib/period";
import { fmtDateID, fmtNum, fmtRupiah } from "@/lib/format";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard } from "@/components/ui/chart-card";
import { Badge } from "@/components/ui/badge";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { Donut } from "@/components/charts/donut";
import { ExportButtons } from "@/components/ui/export-buttons";
import type { ExportSpec } from "@/lib/export/types";
import { MemberMenuReportPanel } from "./member-menu-report-panel";

export function MembershipTab() {
  const { outlet, dateStart, dateEnd } = useDashboardFilters();
  const { prevStart, prevEnd } = getPreviousPeriod(dateStart, dateEnd);

  const summaryQuery = useQuery({
    queryKey: ["membership-summary", outlet, dateStart, dateEnd],
    queryFn: () => getMembershipSummary(dateStart, dateEnd, outlet),
  });
  const summaryPrevQuery = useQuery({
    queryKey: ["membership-summary", outlet, prevStart, prevEnd],
    queryFn: () => getMembershipSummary(prevStart, prevEnd, outlet),
  });
  const weeklyQuery = useQuery({
    queryKey: ["membership-new-weekly", dateEnd],
    queryFn: () => getMembershipNewWeekly(dateEnd),
  });
  const topMembersQuery = useQuery({
    queryKey: ["top-members", outlet, dateStart, dateEnd],
    queryFn: () => getTopMembers(dateStart, dateEnd, outlet),
  });

  if (!summaryQuery.data || !weeklyQuery.data || !topMembersQuery.data) {
    return <div className="text-sm text-text-secondary">Memuat data...</div>;
  }

  const summary = summaryQuery.data;
  const prevSummary = summaryPrevQuery.data;
  const weeklyBars = weeklyQuery.data.map((w, i) => ({ label: `M${i + 1}`, value: w.new_members ?? 0 }));
  const activePct = summary.active_pct ?? 0;
  const churnPct = summary.churn_pct ?? 0;

  type TopMemberRow = (typeof topMembersQuery.data)[number];
  const topMembersExportSpec: ExportSpec<TopMemberRow> = {
    fileBaseName: "top-member",
    title: "Top Member by Spending",
    // topMembersQuery.data is already limited to the top N shown on screen --
    // unlike Sales Bill List, there's no "show all" control on this panel, so
    // exporting always matches what's visible, never a full-population export.
    subtitle: `${fmtDateID(dateStart)} - ${fmtDateID(dateEnd)}`,
    columns: [
      { header: "Nama", accessor: (m) => m.member_name, width: 22 },
      { header: "Outlet", accessor: (m) => m.outlet_name, width: 18 },
      { header: "Tier", accessor: (m) => m.tier, width: 12 },
      { header: "Kunjungan", accessor: (m) => m.visits, format: "number", align: "right", width: 12 },
      { header: "Total Spending", accessor: (m) => m.spending, format: "currency", align: "right", width: 16 },
      { header: "Menu Favorit", accessor: (m) => m.favorite_menu ?? "-", width: 20 },
    ],
  };

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 lg:gap-5 mb-6">
        <KpiCard
          label="Total Member"
          value={fmtNum(summary.total_members)}
          {...deltaLabel(prevSummary ? pctDelta(summary.total_members, prevSummary.total_members) : null)}
        />
        <KpiCard label="Member Aktif" value={`${activePct}%`} delta="dari total member" deltaColor="#2563eb" />
        <KpiCard
          label="Retention Rate"
          value={`${summary.retention_pct ?? 0}%`}
          {...deltaLabel(prevSummary ? pctDelta(summary.retention_pct ?? 0, prevSummary.retention_pct ?? 0) : null)}
        />
        <KpiCard
          label="Frekuensi Kunjungan"
          value={`${summary.visit_frequency ?? 0}x/bulan`}
          delta="rata-rata per member"
          deltaColor="#2563eb"
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4 lg:gap-5 mb-6">
        <ChartCard title="Member Baru per Minggu">
          <SimpleBarChart data={weeklyBars} height={140} showAxisLabels valueFormatter={fmtNum} />
        </ChartCard>

        <div className="bg-surface border border-border rounded-[14px] p-5 flex flex-col items-center justify-center gap-3">
          <div className="text-sm font-bold text-text self-start">Aktif vs Churn</div>
          <Donut percent={activePct} centerValue={`${churnPct}%`} centerLabel="Churn" />
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-accent" />
              Aktif
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-track-inactive" />
              Tidak Aktif
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-[14px] p-5 overflow-x-auto">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-3.5">
          <div className="text-sm font-bold text-text">Top Member by Spending</div>
          <ExportButtons
            spec={topMembersExportSpec}
            dateStart={dateStart}
            dateEnd={dateEnd}
            rows={topMembersQuery.data}
            disabled={topMembersQuery.data.length === 0}
          />
        </div>
        <div className="min-w-[620px]">
          <div className="grid grid-cols-[2fr_1.4fr_1fr_1fr_1fr_1.4fr] text-[11px] font-semibold text-text-secondary pb-2.5 px-1 border-b border-border-subtle">
            <div>Nama</div>
            <div>Outlet</div>
            <div>Tier</div>
            <div>Kunjungan</div>
            <div>Total Spending</div>
            <div>Menu Favorit</div>
          </div>
          {topMembersQuery.data.map((m) => (
            <div
              key={m.member_code}
              className="grid grid-cols-[2fr_1.4fr_1fr_1fr_1fr_1.4fr] text-[13px] py-[11px] px-1 border-b border-border-hairline items-center"
            >
              <div className="font-semibold text-text">{m.member_name}</div>
              <div className="text-text-secondary">{m.outlet_name}</div>
              <div>
                <Badge bg="oklch(94% 0.03 255)" color="#2563eb">
                  {m.tier}
                </Badge>
              </div>
              <div>{fmtNum(m.visits)}</div>
              <div className="font-bold text-text">{fmtRupiah(m.spending)}</div>
              <div className="text-text-secondary">{m.favorite_menu ?? "-"}</div>
            </div>
          ))}
        </div>
      </div>

      <MemberMenuReportPanel key={`${outlet}|${dateStart}|${dateEnd}`} outlet={outlet} dateStart={dateStart} dateEnd={dateEnd} />
    </>
  );
}
