"use client";

import { useQuery } from "@tanstack/react-query";
import { useDashboardFilters, ALL_OUTLETS } from "@/lib/use-dashboard-filters";
import { getSalesDailyOutlet } from "@/lib/queries/sales";
import { getMembershipSummary, getMembershipNewWeekly } from "@/lib/queries/membership";
import { getOutletOptions } from "@/lib/queries/meta";
import { groupRevenueByDate, groupRevenueByOutlet, sumSalesDaily } from "@/lib/aggregate";
import { getPreviousPeriod, pctDelta, deltaLabel } from "@/lib/period";
import { fmtDateID, fmtNum, fmtRupiah } from "@/lib/format";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard } from "@/components/ui/chart-card";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { OutletBarList } from "@/components/charts/outlet-bar-list";
import { Donut } from "@/components/charts/donut";

export function OverviewTab() {
  const { outlet, dateStart, dateEnd } = useDashboardFilters();
  const { prevStart, prevEnd } = getPreviousPeriod(dateStart, dateEnd);

  const currentQuery = useQuery({
    queryKey: ["sales-daily", outlet, dateStart, dateEnd],
    queryFn: () => getSalesDailyOutlet(dateStart, dateEnd, outlet),
  });
  const previousQuery = useQuery({
    queryKey: ["sales-daily", outlet, prevStart, prevEnd],
    queryFn: () => getSalesDailyOutlet(prevStart, prevEnd, outlet),
  });
  const allOutletsQuery = useQuery({
    queryKey: ["sales-daily", ALL_OUTLETS, dateStart, dateEnd],
    queryFn: () => getSalesDailyOutlet(dateStart, dateEnd, ALL_OUTLETS),
  });
  const outletOptionsQuery = useQuery({ queryKey: ["outlet-options"], queryFn: getOutletOptions });

  const membershipQuery = useQuery({
    queryKey: ["membership-summary", outlet, dateStart, dateEnd],
    queryFn: () => getMembershipSummary(dateStart, dateEnd, outlet),
  });
  const membershipPrevQuery = useQuery({
    queryKey: ["membership-summary", outlet, prevStart, prevEnd],
    queryFn: () => getMembershipSummary(prevStart, prevEnd, outlet),
  });
  const weeklyNewQuery = useQuery({
    queryKey: ["membership-new-weekly", dateEnd],
    queryFn: () => getMembershipNewWeekly(dateEnd),
  });

  if (!currentQuery.data || !previousQuery.data || !allOutletsQuery.data || !outletOptionsQuery.data || !membershipQuery.data) {
    return <div className="text-sm text-text-secondary">Memuat data...</div>;
  }

  const current = sumSalesDaily(currentQuery.data);
  const previous = sumSalesDaily(previousQuery.data);
  const aov = current.trans_count ? current.revenue / current.trans_count : 0;
  const prevAov = previous.trans_count ? previous.revenue / previous.trans_count : 0;

  const membership = membershipQuery.data;
  const membershipPrev = membershipPrevQuery.data;
  const weeklyNew = weeklyNewQuery.data ?? [];
  const latestWeek = weeklyNew[weeklyNew.length - 1];
  const prevWeek = weeklyNew[weeklyNew.length - 2];

  const memberRevenuePct = current.revenue > 0 ? (current.member_revenue / current.revenue) * 100 : 0;

  const trendBars = groupRevenueByDate(currentQuery.data).map((d) => ({ label: d.date, value: d.revenue }));
  const outletBars = groupRevenueByOutlet(allOutletsQuery.data, outletOptionsQuery.data);
  const maxOutletRevenue = Math.max(1, ...outletBars.map((o) => o.revenue));

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 lg:gap-5 mb-6">
        <KpiCard
          label="Total Revenue"
          value={fmtRupiah(current.revenue)}
          {...deltaLabel(pctDelta(current.revenue, previous.revenue))}
        />
        <KpiCard
          label="Nett Sales"
          value={fmtRupiah(current.nett_sales)}
          {...deltaLabel(pctDelta(current.nett_sales, previous.nett_sales))}
        />
        <KpiCard
          label="Total Transaksi"
          value={fmtNum(current.trans_count)}
          {...deltaLabel(pctDelta(current.trans_count, previous.trans_count))}
        />
        <KpiCard label="AOV" value={fmtRupiah(aov)} {...deltaLabel(pctDelta(aov, prevAov))} />
        <KpiCard
          label="Total Member"
          value={fmtNum(membership.total_members)}
          {...deltaLabel(membershipPrev ? pctDelta(membership.total_members, membershipPrev.total_members) : null)}
        />
        <KpiCard
          label="Member Baru"
          value={fmtNum(latestWeek?.new_members ?? 0)}
          {...deltaLabel(prevWeek ? pctDelta(latestWeek?.new_members ?? 0, prevWeek.new_members ?? 0) : null, {
            suffix: "vs minggu lalu",
          })}
        />
        <KpiCard
          label="Churn Rate"
          value={`${membership.churn_pct ?? 0}%`}
          {...deltaLabel(membershipPrev ? pctDelta(membership.churn_pct ?? 0, membershipPrev.churn_pct ?? 0) : null, {
            invert: true,
          })}
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4 lg:gap-5">
        <ChartCard title="Tren Revenue Harian" fullWidth>
          <SimpleBarChart data={trendBars} valueFormatter={fmtRupiah} labelFormatter={fmtDateID} />
        </ChartCard>

        <ChartCard title="Revenue per Outlet">
          <OutletBarList
            items={outletBars.map((o) => ({
              name: o.branch_name,
              valueLabel: fmtRupiah(o.revenue),
              pct: (o.revenue / maxOutletRevenue) * 100,
            }))}
          />
        </ChartCard>

        <div className="bg-surface border border-border rounded-[14px] p-5 flex flex-col justify-center items-center gap-3.5">
          <div className="text-sm font-bold text-text self-start">Kontribusi Revenue Member</div>
          <Donut percent={memberRevenuePct} centerValue={`${Math.round(memberRevenuePct)}%`} centerLabel="Member" />
        </div>
      </div>
    </>
  );
}
