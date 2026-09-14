"use client";

import { useQuery } from "@tanstack/react-query";
import { useDashboardFilters } from "@/lib/use-dashboard-filters";
import { getSalesDailyOutlet } from "@/lib/queries/sales";
import { getSalesChannelDaily, getSalesOpsDaily, getSalesPaymentMethodDaily } from "@/lib/queries/ops";
import { groupByChannel, groupByPaymentMethod, sumSalesDaily, sumSalesOpsDaily } from "@/lib/aggregate";
import { getPreviousPeriod, pctDelta, deltaLabel } from "@/lib/period";
import { fmtDurationMin, fmtNum, fmtRupiah } from "@/lib/format";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard } from "@/components/ui/chart-card";
import { OutletBarList } from "@/components/charts/outlet-bar-list";

export function OpsTab() {
  const { outlet, dateStart, dateEnd } = useDashboardFilters();
  const { prevStart, prevEnd } = getPreviousPeriod(dateStart, dateEnd);

  const opsQuery = useQuery({
    queryKey: ["sales-ops", outlet, dateStart, dateEnd],
    queryFn: () => getSalesOpsDaily(dateStart, dateEnd, outlet),
  });
  const opsPrevQuery = useQuery({
    queryKey: ["sales-ops", outlet, prevStart, prevEnd],
    queryFn: () => getSalesOpsDaily(prevStart, prevEnd, outlet),
  });
  const revenueQuery = useQuery({
    queryKey: ["sales-daily", outlet, dateStart, dateEnd],
    queryFn: () => getSalesDailyOutlet(dateStart, dateEnd, outlet),
  });
  const channelQuery = useQuery({
    queryKey: ["sales-channel", outlet, dateStart, dateEnd],
    queryFn: () => getSalesChannelDaily(dateStart, dateEnd, outlet),
  });
  const paymentQuery = useQuery({
    queryKey: ["sales-payment-method", outlet, dateStart, dateEnd],
    queryFn: () => getSalesPaymentMethodDaily(dateStart, dateEnd, outlet),
  });

  const queries = [opsQuery, opsPrevQuery, revenueQuery, channelQuery, paymentQuery];
  const failedQuery = queries.find((q) => q.isError);
  if (failedQuery) {
    return (
      <div className="text-sm text-[#dc2626]">
        Gagal memuat data: {failedQuery.error instanceof Error ? failedQuery.error.message : "Terjadi kesalahan tak terduga"}
      </div>
    );
  }

  if (!opsQuery.data || !opsPrevQuery.data || !revenueQuery.data || !channelQuery.data || !paymentQuery.data) {
    return <div className="text-sm text-text-secondary">Memuat data...</div>;
  }

  const ops = sumSalesOpsDaily(opsQuery.data);
  const opsPrev = sumSalesOpsDaily(opsPrevQuery.data);
  const revenue = sumSalesDaily(revenueQuery.data).revenue;

  const cancelVoidRate = ops.trans_count_all
    ? ((ops.cancelled_count + ops.void_count) / ops.trans_count_all) * 100
    : 0;
  const prevCancelVoidRate = opsPrev.trans_count_all
    ? ((opsPrev.cancelled_count + opsPrev.void_count) / opsPrev.trans_count_all) * 100
    : 0;
  const cancelVoidDelta = deltaLabel(pctDelta(cancelVoidRate, prevCancelVoidRate), { invert: true });

  const avgDwellMin = ops.dwell_sample_count ? ops.dwell_seconds_sum / ops.dwell_sample_count / 60 : 0;
  const prevAvgDwellMin = opsPrev.dwell_sample_count ? opsPrev.dwell_seconds_sum / opsPrev.dwell_sample_count / 60 : 0;
  const dwellDelta = deltaLabel(pctDelta(avgDwellMin, prevAvgDwellMin));

  const revenuePerCover = ops.pax_total_sum ? revenue / ops.pax_total_sum : 0;

  const channelBars = groupByChannel(channelQuery.data);
  const maxChannelRevenue = Math.max(1, ...channelBars.map((c) => c.revenue));

  const paymentBars = groupByPaymentMethod(paymentQuery.data);
  const maxPaymentAmount = Math.max(1, ...paymentBars.map((p) => p.payment_amount));

  // Neutral, fixed order -- not sorted by count -- so the panel doesn't
  // visually imply a ranking/severity judgment about any one status. In
  // particular "New" is NOT confirmed to mean "unresolved"/"problem" (see
  // migration 20260828090000_ops_analytics.sql); it is shown as-is.
  const statusBars = [
    { name: "Finished", value: ops.trans_count_finished },
    { name: "New", value: ops.new_count },
    { name: "Cancelled", value: ops.cancelled_count },
    { name: "Void", value: ops.void_count },
  ];
  const maxStatusCount = Math.max(1, ...statusBars.map((s) => s.value));

  const discountBars = [
    { name: "Diskon Menu", value: ops.menu_discount_sum },
    { name: "Diskon Promo", value: ops.promotion_discount_sum },
    { name: "Diskon Voucher", value: ops.voucher_discount_sum },
  ];
  const maxDiscount = Math.max(1, ...discountBars.map((d) => d.value));

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 lg:gap-5 mb-6">
        <KpiCard
          label="Tingkat Cancel/Void"
          value={`${cancelVoidRate.toFixed(1)}%`}
          delta={cancelVoidDelta.text}
          deltaColor={cancelVoidDelta.color}
        />
        <KpiCard
          label="Rata-rata Dwell Time"
          value={fmtDurationMin(avgDwellMin)}
          delta={dwellDelta.text}
          deltaColor={dwellDelta.color}
        />
        <KpiCard label="Revenue per Cover" value={fmtRupiah(revenuePerCover)} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4 lg:gap-5">
        <ChartCard title="Channel Mix">
          <OutletBarList
            items={channelBars.map((c) => ({
              name: c.channel,
              valueLabel: fmtRupiah(c.revenue),
              pct: (c.revenue / maxChannelRevenue) * 100,
            }))}
          />
        </ChartCard>

        <ChartCard title="Metode Pembayaran">
          <OutletBarList
            items={paymentBars.map((p) => ({
              name: p.payment_method_type_name,
              valueLabel: fmtRupiah(p.payment_amount),
              pct: (p.payment_amount / maxPaymentAmount) * 100,
            }))}
          />
        </ChartCard>

        <ChartCard title="Distribusi Status Transaksi">
          <OutletBarList
            items={statusBars.map((s) => ({
              name: s.name,
              valueLabel: `${fmtNum(s.value)} transaksi`,
              pct: (s.value / maxStatusCount) * 100,
            }))}
          />
        </ChartCard>

        <ChartCard title="Breakdown Jenis Diskon">
          <OutletBarList
            items={discountBars.map((d) => ({
              name: d.name,
              valueLabel: fmtRupiah(d.value),
              pct: (d.value / maxDiscount) * 100,
            }))}
          />
        </ChartCard>
      </div>
    </>
  );
}
