"use client";

import { useQuery } from "@tanstack/react-query";
import { ALL_OUTLETS } from "@/lib/use-dashboard-filters";
import { getSalesDailyOutlet } from "@/lib/queries/sales";
import { getOutletOptions } from "@/lib/queries/meta";
import { groupSalesByOutlet } from "@/lib/aggregate";
import { getPreviousPeriod, pctDelta, deltaLabel } from "@/lib/period";
import { fmtDateID, fmtNum, fmtRupiah } from "@/lib/format";
import { ExportButtons } from "@/components/ui/export-buttons";
import type { ExportSpec } from "@/lib/export/types";

const GRID = "grid-cols-[0.4fr_1.8fr_1.3fr_1.3fr_1fr_1.2fr_1.4fr]";

/**
 * Always cross-outlet regardless of the global outlet filter -- ranking one
 * outlet against itself isn't a leaderboard, same reasoning as why the
 * "Revenue per Outlet" bar chart on this tab ignores the outlet filter too.
 * Deliberately its own component with its own queries (rather than reusing
 * OverviewTab's already-fetched data) so it can be dropped into any tab
 * later without threading props through; TanStack Query dedupes the
 * `sales-daily`/`outlet-options` cache keys against whatever OverviewTab
 * already fetched, so this costs no extra network round-trip in practice.
 */
export function OutletLeaderboardPanel({ dateStart, dateEnd }: { dateStart: string; dateEnd: string }) {
  const { prevStart, prevEnd } = getPreviousPeriod(dateStart, dateEnd);

  const currentQuery = useQuery({
    queryKey: ["sales-daily", ALL_OUTLETS, dateStart, dateEnd],
    queryFn: () => getSalesDailyOutlet(dateStart, dateEnd, ALL_OUTLETS),
  });
  const previousQuery = useQuery({
    queryKey: ["sales-daily", ALL_OUTLETS, prevStart, prevEnd],
    queryFn: () => getSalesDailyOutlet(prevStart, prevEnd, ALL_OUTLETS),
  });
  const outletOptionsQuery = useQuery({ queryKey: ["outlet-options"], queryFn: getOutletOptions });

  const isLoading = currentQuery.isLoading || previousQuery.isLoading || outletOptionsQuery.isLoading;

  return (
    <div className="bg-surface border border-border rounded-[14px] p-5 mt-4 overflow-x-auto">
      {isLoading || !currentQuery.data || !previousQuery.data || !outletOptionsQuery.data ? (
        <>
          <div className="text-sm font-bold text-text mb-3.5">Peringkat Outlet</div>
          <div className="text-sm text-text-secondary py-4">Memuat data...</div>
        </>
      ) : (
        <LeaderboardTable
          current={groupSalesByOutlet(currentQuery.data, outletOptionsQuery.data)}
          previous={groupSalesByOutlet(previousQuery.data, outletOptionsQuery.data)}
          dateStart={dateStart}
          dateEnd={dateEnd}
        />
      )}
    </div>
  );
}

type OutletRow = ReturnType<typeof groupSalesByOutlet>[number];

function LeaderboardTable({
  current,
  previous,
  dateStart,
  dateEnd,
}: {
  current: OutletRow[];
  previous: OutletRow[];
  dateStart: string;
  dateEnd: string;
}) {
  const prevByCode = new Map(previous.map((o) => [o.branch_code, o]));
  const ranked = [...current].sort((a, b) => b.revenue - a.revenue).map((o, i) => {
    const prev = prevByCode.get(o.branch_code);
    const aov = o.trans_count ? o.revenue / o.trans_count : 0;
    return { ...o, rank: i + 1, aov, ...deltaLabel(pctDelta(o.revenue, prev?.revenue ?? 0)) };
  });

  const exportSpec: ExportSpec<(typeof ranked)[number]> = {
    fileBaseName: "peringkat-outlet",
    title: "Peringkat Outlet",
    // Hardcoded, not the page's outlet filter -- this panel is always
    // cross-outlet regardless of it (see the component doc comment above).
    subtitle: `${fmtDateID(dateStart)} - ${fmtDateID(dateEnd)} | Semua Outlet`,
    columns: [
      { header: "#", accessor: (o) => o.rank, format: "number", align: "right", width: 6 },
      { header: "Outlet", accessor: (o) => o.branch_name, width: 24 },
      { header: "Revenue", accessor: (o) => o.revenue, format: "currency", align: "right", width: 16 },
      { header: "Nett Sales", accessor: (o) => o.nett_sales, format: "currency", align: "right", width: 16 },
      { header: "Transaksi", accessor: (o) => o.trans_count, format: "number", align: "right", width: 12 },
      { header: "AOV", accessor: (o) => o.aov, format: "currency", align: "right", width: 14 },
      { header: "vs Periode Lalu", accessor: (o) => o.delta, width: 18 },
    ],
  };

  return (
    <div className="min-w-[720px]">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3.5">
        <div className="text-sm font-bold text-text">Peringkat Outlet</div>
        <ExportButtons
          spec={exportSpec}
          dateStart={dateStart}
          dateEnd={dateEnd}
          rows={ranked}
          disabled={ranked.length === 0}
        />
      </div>

      {ranked.length === 0 ? (
        <div className="text-sm text-text-secondary py-4">Belum ada data outlet.</div>
      ) : (
        <>
          <div className={`grid ${GRID} text-[11px] font-semibold text-text-secondary pb-2.5 px-1 border-b border-border-subtle`}>
            <div>#</div>
            <div>Outlet</div>
            <div>Revenue</div>
            <div>Nett Sales</div>
            <div>Transaksi</div>
            <div>AOV</div>
            <div>vs Periode Lalu</div>
          </div>
          {ranked.map((o) => (
            <div
              key={o.branch_code}
              className={`grid ${GRID} text-[13px] py-2.5 px-1 border-b border-border-hairline items-center`}
            >
              <div className="text-text-secondary">{o.rank}</div>
              <div className="font-semibold text-text">{o.branch_name}</div>
              <div>{fmtRupiah(o.revenue)}</div>
              <div>{fmtRupiah(o.nett_sales)}</div>
              <div>{fmtNum(o.trans_count)}</div>
              <div>{fmtRupiah(o.aov)}</div>
              <div className="font-semibold text-xs" style={{ color: o.deltaColor }}>
                {o.delta}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
