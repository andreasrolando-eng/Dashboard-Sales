import { ALL_CATEGORIES, ALL_CATEGORY_DETAILS, ALL_OUTLETS } from "@/lib/use-dashboard-filters";
import { getMenuPerformance, getProductAggregates, getSalesDailyOutlet } from "@/lib/queries/sales";
import { getSalesChannelDaily, getSalesOpsDaily, getSalesPaymentMethodDaily } from "@/lib/queries/ops";
import { getPromoPerformance } from "@/lib/queries/marketing";
import { getMembershipSummary, getTopMembers } from "@/lib/queries/membership";
import { getOutletOptions } from "@/lib/queries/meta";
import {
  groupByChannel,
  groupByPaymentMethod,
  groupRevenueByOutlet,
  groupSalesByOutlet,
  sumSalesDaily,
  sumSalesOpsDaily,
} from "@/lib/aggregate";
import { fmtDurationMin, fmtNum, fmtRupiah } from "@/lib/format";
import type { ExportColumn } from "./types";
import type { ReportSection } from "./pdf";

const MENU_UNDERPERFORMING_THRESHOLD = 100;
const REPORT_TOP_MEMBERS_LIMIT = 50;
// Plain-text version -- jsPDF's default fonts don't reliably render arrow glyphs (see menu-underperforming-panel.tsx).
const TREND_LABEL_PLAIN = { naik: "Naik", turun: "Turun", stagnan: "Stagnan" } as const;

export interface FullReportParams {
  dateStart: string;
  dateEnd: string;
  outlet: string;
}

/**
 * Fetches every dashboard tab's KPIs + tables for the "Laporan Lengkap"
 * button in the Header -- scoped to whatever date range/outlet filter is
 * currently active on the dashboard (same params useDashboardFilters()
 * returns), so the report matches what the user is looking at. Calls the
 * same plain async query functions each tab's useQuery hooks call, just
 * directly on click instead of through React Query.
 */
export async function buildFullReportSections(
  { dateStart, dateEnd, outlet }: FullReportParams,
  onProgress?: (label: string) => void
): Promise<{ sections: ReportSection[]; dateStart: string; dateEnd: string; outletLabel: string }> {
  onProgress?.("Mengambil data Overview...");
  const [salesDaily, outlets, membership] = await Promise.all([
    getSalesDailyOutlet(dateStart, dateEnd, outlet),
    getOutletOptions(),
    getMembershipSummary(dateStart, dateEnd, outlet),
  ]);
  const sales = sumSalesDaily(salesDaily);
  const aov = sales.trans_count ? sales.revenue / sales.trans_count : 0;
  // Scoped to the selected outlet, not always cross-outlet -- unlike
  // OutletLeaderboardPanel/Overview's live chart, this report is meant to
  // mirror whatever the user is currently filtered to.
  const scopedOutlets = outlet === ALL_OUTLETS ? outlets : outlets.filter((o) => o.branch_code === outlet);
  const outletLabel = outlet === ALL_OUTLETS ? ALL_OUTLETS : (scopedOutlets[0]?.branch_name ?? outlet);
  const outletRevenue = groupRevenueByOutlet(salesDaily, scopedOutlets);
  const outletSales = groupSalesByOutlet(salesDaily, scopedOutlets);

  const overviewSection: ReportSection = {
    heading: "Overview",
    kpis: [
      { label: "Total Revenue", value: fmtRupiah(sales.revenue) },
      { label: "Nett Sales", value: fmtRupiah(sales.nett_sales) },
      { label: "Total Transaksi", value: fmtNum(sales.trans_count) },
      { label: "AOV", value: fmtRupiah(aov) },
      { label: "Total Member", value: fmtNum(membership.total_members) },
      { label: "Churn Rate", value: `${membership.churn_pct ?? 0}%` },
    ],
    tables: [
      {
        title: "Revenue per Outlet",
        columns: [
          { header: "Outlet", accessor: (o) => o.branch_name, width: 24 },
          { header: "Revenue", accessor: (o) => o.revenue, format: "currency", align: "right", width: 18 },
        ] satisfies ExportColumn<(typeof outletRevenue)[number]>[],
        rows: outletRevenue,
      },
    ],
  };

  onProgress?.("Mengambil data Sales...");
  const [products, menuPerf] = await Promise.all([
    getProductAggregates(dateStart, dateEnd, outlet, ALL_CATEGORIES, ALL_CATEGORY_DETAILS),
    getMenuPerformance(dateStart, dateEnd, outlet, ALL_CATEGORIES, ALL_CATEGORY_DETAILS, MENU_UNDERPERFORMING_THRESHOLD),
  ]);
  const topSellers = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const slowMovers = [...products].sort((a, b) => a.qty - b.qty).slice(0, 10);
  const productColumns: ExportColumn<(typeof products)[number]>[] = [
    { header: "Menu", accessor: (p) => p.menu_name, width: 26 },
    { header: "Kategori", accessor: (p) => p.category, width: 18 },
    { header: "Unit Terjual", accessor: (p) => p.qty, format: "number", align: "right", width: 14 },
    { header: "Revenue", accessor: (p) => p.revenue, format: "currency", align: "right", width: 16 },
  ];

  const salesSection: ReportSection = {
    heading: "Sales",
    kpis: [
      { label: "Total Revenue", value: fmtRupiah(sales.revenue) },
      { label: "Nett Sales", value: fmtRupiah(sales.nett_sales) },
      { label: "Total Transaksi", value: fmtNum(sales.trans_count) },
      { label: "AOV", value: fmtRupiah(aov) },
    ],
    tables: [
      { title: "Top Seller", columns: productColumns, rows: topSellers },
      { title: "Slow Moving", columns: productColumns, rows: slowMovers },
      {
        title: "Menu Underperforming",
        columns: [
          { header: "Menu", accessor: (r) => r.menu_name, width: 26 },
          { header: "Unit Terjual", accessor: (r) => r.qty, format: "number", align: "right", width: 14 },
          { header: "Kontribusi Revenue", accessor: (r) => r.contribution_pct ?? 0, format: "percent", align: "right", width: 16 },
          { header: "Tren", accessor: (r) => TREND_LABEL_PLAIN[r.trend], width: 12 },
          { header: "Status", accessor: (r) => (r.is_takeout_candidate ? "Kandidat Takeout" : "Pantau"), width: 16 },
        ] satisfies ExportColumn<(typeof menuPerf)[number]>[],
        rows: menuPerf,
      },
    ],
  };

  onProgress?.("Mengambil data Ops...");
  const [opsDaily, channelDaily, paymentDaily] = await Promise.all([
    getSalesOpsDaily(dateStart, dateEnd, outlet),
    getSalesChannelDaily(dateStart, dateEnd, outlet),
    getSalesPaymentMethodDaily(dateStart, dateEnd, outlet),
  ]);
  const ops = sumSalesOpsDaily(opsDaily);
  const cancelVoidRate = ops.trans_count_all ? ((ops.cancelled_count + ops.void_count) / ops.trans_count_all) * 100 : 0;
  const avgDwellMin = ops.dwell_sample_count ? ops.dwell_seconds_sum / ops.dwell_sample_count / 60 : 0;
  const revenuePerCover = ops.pax_total_sum ? sales.revenue / ops.pax_total_sum : 0;
  const channelRows = groupByChannel(channelDaily);
  const paymentRows = groupByPaymentMethod(paymentDaily);
  // Fixed, neutral order -- not sorted by count -- same reasoning as ops-tab.tsx's statusBars/discountBars.
  const statusRows = [
    { name: "Finished", count: ops.trans_count_finished },
    { name: "New", count: ops.new_count },
    { name: "Cancelled", count: ops.cancelled_count },
    { name: "Void", count: ops.void_count },
  ];
  const discountRows = [
    { name: "Diskon Menu", amount: ops.menu_discount_sum },
    { name: "Diskon Promo", amount: ops.promotion_discount_sum },
    { name: "Diskon Voucher", amount: ops.voucher_discount_sum },
  ];

  const opsSection: ReportSection = {
    heading: "Ops",
    kpis: [
      { label: "Tingkat Cancel/Void", value: `${cancelVoidRate.toFixed(1)}%` },
      { label: "Rata-rata Dwell Time", value: fmtDurationMin(avgDwellMin) },
      { label: "Revenue per Cover", value: fmtRupiah(revenuePerCover) },
    ],
    tables: [
      {
        title: "Channel Mix",
        columns: [
          { header: "Channel", accessor: (c) => c.channel, width: 20 },
          { header: "Revenue", accessor: (c) => c.revenue, format: "currency", align: "right", width: 16 },
          { header: "Transaksi", accessor: (c) => c.trans_count, format: "number", align: "right", width: 14 },
        ] satisfies ExportColumn<(typeof channelRows)[number]>[],
        rows: channelRows,
      },
      {
        title: "Metode Pembayaran",
        columns: [
          { header: "Metode", accessor: (p) => p.payment_method_type_name, width: 20 },
          { header: "Jumlah", accessor: (p) => p.payment_amount, format: "currency", align: "right", width: 16 },
          { header: "Transaksi", accessor: (p) => p.payment_count, format: "number", align: "right", width: 14 },
        ] satisfies ExportColumn<(typeof paymentRows)[number]>[],
        rows: paymentRows,
      },
      {
        title: "Distribusi Status Transaksi",
        columns: [
          { header: "Status", accessor: (s) => s.name, width: 20 },
          { header: "Transaksi", accessor: (s) => s.count, format: "number", align: "right", width: 14 },
        ] satisfies ExportColumn<(typeof statusRows)[number]>[],
        rows: statusRows,
      },
      {
        title: "Breakdown Jenis Diskon",
        columns: [
          { header: "Jenis Diskon", accessor: (d) => d.name, width: 20 },
          { header: "Jumlah", accessor: (d) => d.amount, format: "currency", align: "right", width: 16 },
        ] satisfies ExportColumn<(typeof discountRows)[number]>[],
        rows: discountRows,
      },
    ],
  };

  onProgress?.("Mengambil data Membership...");
  const topMembers = await getTopMembers(dateStart, dateEnd, outlet, REPORT_TOP_MEMBERS_LIMIT);

  const membershipSection: ReportSection = {
    heading: "Membership",
    kpis: [
      { label: "Total Member", value: fmtNum(membership.total_members) },
      { label: "Member Aktif", value: `${membership.active_pct ?? 0}%` },
      { label: "Retention Rate", value: `${membership.retention_pct ?? 0}%` },
      { label: "Frekuensi Kunjungan", value: `${membership.visit_frequency ?? 0}x/bulan` },
    ],
    tables: [
      {
        title: "Top Member by Spending",
        columns: [
          { header: "Nama", accessor: (m) => m.member_name, width: 22 },
          { header: "Outlet", accessor: (m) => m.outlet_name, width: 18 },
          { header: "Tier", accessor: (m) => m.tier, width: 12 },
          { header: "Kunjungan", accessor: (m) => m.visits, format: "number", align: "right", width: 12 },
          { header: "Total Spending", accessor: (m) => m.spending, format: "currency", align: "right", width: 16 },
          { header: "Menu Favorit", accessor: (m) => m.favorite_menu ?? "-", width: 20 },
        ] satisfies ExportColumn<(typeof topMembers)[number]>[],
        rows: topMembers,
      },
    ],
  };

  onProgress?.("Mengambil data Marketing...");
  const promos = await getPromoPerformance(dateStart, dateEnd, outlet);
  const totalRedemption = promos.reduce((a, p) => a + p.redemptions, 0);

  const marketingSection: ReportSection = {
    heading: "Marketing",
    kpis: [{ label: "Total Redemption", value: fmtNum(totalRedemption) }],
    tables: [
      {
        title: "Efektivitas Promo",
        columns: [
          { header: "Promo", accessor: (p) => p.promotion_name, width: 26 },
          { header: "Redemption", accessor: (p) => p.redemptions, format: "number", align: "right", width: 14 },
          { header: "Lift", accessor: (p) => p.lift_pct ?? 0, format: "percent", align: "right", width: 12 },
          { header: "ROI", accessor: (p) => p.roi ?? 0, format: "number", align: "right", width: 10 },
          { header: "Status", accessor: (p) => p.status, width: 16 },
        ] satisfies ExportColumn<(typeof promos)[number]>[],
        rows: promos,
      },
      {
        title: "Peringkat Outlet",
        columns: [
          { header: "Outlet", accessor: (o) => o.branch_name, width: 24 },
          { header: "Revenue", accessor: (o) => o.revenue, format: "currency", align: "right", width: 16 },
          { header: "Nett Sales", accessor: (o) => o.nett_sales, format: "currency", align: "right", width: 16 },
          { header: "Transaksi", accessor: (o) => o.trans_count, format: "number", align: "right", width: 12 },
        ] satisfies ExportColumn<(typeof outletSales)[number]>[],
        rows: outletSales,
      },
    ],
  };

  return {
    sections: [overviewSection, salesSection, opsSection, membershipSection, marketingSection],
    dateStart,
    dateEnd,
    outletLabel,
  };
}
