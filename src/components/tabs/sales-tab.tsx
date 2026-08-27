"use client";

import { useQuery } from "@tanstack/react-query";
import { useDashboardFilters, ALL_OUTLETS, ALL_CATEGORIES, ALL_CATEGORY_DETAILS } from "@/lib/use-dashboard-filters";
import { getProductAggregates, getSalesDailyOutlet, getSalesHourlyOutlet, getSalesRevenueByCategory } from "@/lib/queries/sales";
import { getOutletOptions } from "@/lib/queries/meta";
import { groupByHour, groupRevenueByDate, groupRevenueByOutlet, sumSalesDaily } from "@/lib/aggregate";
import { getPreviousPeriod, pctDelta, deltaLabel } from "@/lib/period";
import { fmtDateFullID, fmtNum, fmtRupiah } from "@/lib/format";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard } from "@/components/ui/chart-card";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { OutletBarList } from "@/components/charts/outlet-bar-list";
import { MenuUnderperformingPanel } from "./menu-underperforming-panel";
import { SalesBillListPanel } from "./sales-bill-list-panel";

export function SalesTab() {
  const { outlet, category, categoryDetail, dateStart, dateEnd } = useDashboardFilters();
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
  const hourlyQuery = useQuery({
    queryKey: ["sales-hourly", outlet, dateStart, dateEnd],
    queryFn: () => getSalesHourlyOutlet(dateStart, dateEnd, outlet),
  });
  const productsQuery = useQuery({
    queryKey: ["product-aggregates", outlet, category, categoryDetail, dateStart, dateEnd],
    queryFn: () => getProductAggregates(dateStart, dateEnd, outlet, category, categoryDetail),
  });

  // Total Revenue/Nett Sales only switch to the category-scoped source once
  // a category/categoryDetail filter is actually picked -- keeps the
  // default "Semua Kategori" numbers identical to today's (transaction-grain
  // sum(grand_total)), since the category-scoped view sums item-line totals
  // instead, which isn't guaranteed to match to the rupiah.
  const categoryActive = category !== ALL_CATEGORIES || categoryDetail !== ALL_CATEGORY_DETAILS;
  const categoryRevenueQuery = useQuery({
    queryKey: ["sales-revenue-category", outlet, category, categoryDetail, dateStart, dateEnd],
    queryFn: () => getSalesRevenueByCategory(dateStart, dateEnd, outlet, category, categoryDetail),
    enabled: categoryActive,
  });
  const categoryRevenuePrevQuery = useQuery({
    queryKey: ["sales-revenue-category", outlet, category, categoryDetail, prevStart, prevEnd],
    queryFn: () => getSalesRevenueByCategory(prevStart, prevEnd, outlet, category, categoryDetail),
    enabled: categoryActive,
  });

  const queries = [
    currentQuery,
    previousQuery,
    allOutletsQuery,
    outletOptionsQuery,
    hourlyQuery,
    productsQuery,
    ...(categoryActive ? [categoryRevenueQuery, categoryRevenuePrevQuery] : []),
  ];
  const failedQuery = queries.find((q) => q.isError);
  if (failedQuery) {
    return (
      <div className="text-sm text-[#dc2626]">
        Gagal memuat data: {failedQuery.error instanceof Error ? failedQuery.error.message : "Terjadi kesalahan tak terduga"}
      </div>
    );
  }

  if (
    !currentQuery.data ||
    !previousQuery.data ||
    !allOutletsQuery.data ||
    !outletOptionsQuery.data ||
    !hourlyQuery.data ||
    !productsQuery.data ||
    (categoryActive && (!categoryRevenueQuery.data || !categoryRevenuePrevQuery.data))
  ) {
    return <div className="text-sm text-text-secondary">Memuat data...</div>;
  }

  const current = sumSalesDaily(currentQuery.data);
  const previous = sumSalesDaily(previousQuery.data);
  const aov = current.trans_count ? current.revenue / current.trans_count : 0;
  const prevAov = previous.trans_count ? previous.revenue / previous.trans_count : 0;

  const displayRevenue = categoryActive ? categoryRevenueQuery.data!.revenue : current.revenue;
  const displayRevenuePrev = categoryActive ? categoryRevenuePrevQuery.data!.revenue : previous.revenue;
  const displayNettSales = categoryActive ? categoryRevenueQuery.data!.nett_sales : current.nett_sales;
  const displayNettSalesPrev = categoryActive ? categoryRevenuePrevQuery.data!.nett_sales : previous.nett_sales;

  const trendBars = groupRevenueByDate(currentQuery.data).map((d) => ({ label: d.date, value: d.revenue }));
  const outletBars = groupRevenueByOutlet(allOutletsQuery.data, outletOptionsQuery.data);
  const maxOutletRevenue = Math.max(1, ...outletBars.map((o) => o.revenue));

  const hourly = groupByHour(hourlyQuery.data);
  const peakBars = hourly.map((h) => ({ label: `${h.hour}`, value: h.revenue }));
  const peakHour = [...hourly].sort((a, b) => b.revenue - a.revenue)[0];

  const topSellers = [...productsQuery.data].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const slowMovers = [...productsQuery.data].sort((a, b) => a.qty - b.qty).slice(0, 5);

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 lg:gap-5 mb-6">
        <KpiCard
          label="Total Revenue"
          value={fmtRupiah(displayRevenue)}
          {...deltaLabel(pctDelta(displayRevenue, displayRevenuePrev))}
        />
        <KpiCard
          label="Nett Sales"
          value={fmtRupiah(displayNettSales)}
          {...deltaLabel(pctDelta(displayNettSales, displayNettSalesPrev))}
        />
        <KpiCard
          label="Total Transaksi"
          value={fmtNum(current.trans_count)}
          {...deltaLabel(pctDelta(current.trans_count, previous.trans_count))}
        />
        <KpiCard label="AOV" value={fmtRupiah(aov)} {...deltaLabel(pctDelta(aov, prevAov))} />
        <KpiCard
          label="Peak Hour"
          value={peakHour ? `${peakHour.hour}:00` : "-"}
          delta={peakHour ? `${fmtNum(peakHour.trans_count)} transaksi` : undefined}
          deltaColor="#2563eb"
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4 lg:gap-5 mb-4">
        <ChartCard title="Tren Revenue" fullWidth>
          <SimpleBarChart data={trendBars} height={220} dateAxis valueFormatter={fmtRupiah} labelFormatter={fmtDateFullID} />
        </ChartCard>

        <ChartCard title="Distribusi Peak Hour">
          <SimpleBarChart data={peakBars} height={140} showAxisLabels valueFormatter={fmtRupiah} />
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
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4 lg:gap-5">
        <ChartCard title="Top Seller">
          <ProductList products={topSellers} />
        </ChartCard>
        <ChartCard title="Slow Moving">
          <ProductList products={slowMovers} />
        </ChartCard>
      </div>

      <MenuUnderperformingPanel
        outlet={outlet}
        category={category}
        categoryDetail={categoryDetail}
        dateStart={dateStart}
        dateEnd={dateEnd}
      />

      <SalesBillListPanel key={`${outlet}|${dateStart}|${dateEnd}`} outlet={outlet} dateStart={dateStart} dateEnd={dateEnd} />
    </>
  );
}

function ProductList({
  products,
}: {
  products: { menu_id: string; menu_name: string | null; category: string | null; category_detail: string | null; qty: number; revenue: number }[];
}) {
  return (
    <div>
      {products.map((p) => (
        <div key={p.menu_id} className="flex justify-between items-center py-2.5 border-b border-border-faint last:border-b-0">
          <div>
            <div className="text-[13px] font-semibold text-text">{p.menu_name}</div>
            <div className="text-[11px] text-text-tertiary">
              {p.category}
              {p.category_detail ? ` › ${p.category_detail}` : ""} · {fmtNum(p.qty)} terjual
            </div>
          </div>
          <div className="text-[13px] font-bold text-text">{fmtRupiah(p.revenue)}</div>
        </div>
      ))}
    </div>
  );
}
