interface SalesDailyLike {
  sales_date: string;
  branch_code: string;
  revenue: number | null;
  nett_sales?: number | null;
  trans_count: number | null;
  member_revenue: number | null;
}

export function sumSalesDaily(rows: SalesDailyLike[]) {
  return rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + (r.revenue ?? 0),
      nett_sales: acc.nett_sales + (r.nett_sales ?? 0),
      trans_count: acc.trans_count + (r.trans_count ?? 0),
      member_revenue: acc.member_revenue + (r.member_revenue ?? 0),
    }),
    { revenue: 0, nett_sales: 0, trans_count: 0, member_revenue: 0 }
  );
}

/** Daily revenue summed across whatever outlets are in `rows` (already outlet-filtered upstream if needed). */
export function groupRevenueByDate(rows: SalesDailyLike[]): { date: string; revenue: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.sales_date, (map.get(r.sales_date) ?? 0) + (r.revenue ?? 0));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }));
}

export function groupRevenueByOutlet(
  rows: SalesDailyLike[],
  outlets: { branch_code: string; branch_name: string }[]
): { branch_code: string; branch_name: string; revenue: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.branch_code, (map.get(r.branch_code) ?? 0) + (r.revenue ?? 0));
  }
  return outlets
    .map((o) => ({ ...o, revenue: map.get(o.branch_code) ?? 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

interface SalesHourlyLike {
  hour_of_day: number;
  revenue: number | null;
  trans_count: number | null;
}

export function groupByHour(rows: SalesHourlyLike[]): { hour: number; revenue: number; trans_count: number }[] {
  const map = new Map<number, { revenue: number; trans_count: number }>();
  for (const r of rows) {
    const e = map.get(r.hour_of_day) ?? { revenue: 0, trans_count: 0 };
    e.revenue += r.revenue ?? 0;
    e.trans_count += r.trans_count ?? 0;
    map.set(r.hour_of_day, e);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hour, v]) => ({ hour, ...v }));
}

interface SalesOpsDailyLike {
  trans_count_all: number | null;
  trans_count_finished: number | null;
  cancelled_count: number | null;
  void_count: number | null;
  new_count: number | null;
  dwell_seconds_sum: number | null;
  dwell_sample_count: number | null;
  pax_total_sum: number | null;
  menu_discount_sum: number | null;
  promotion_discount_sum: number | null;
  voucher_discount_sum: number | null;
}

interface SalesOpsSum {
  trans_count_all: number;
  trans_count_finished: number;
  cancelled_count: number;
  void_count: number;
  new_count: number;
  dwell_seconds_sum: number;
  dwell_sample_count: number;
  pax_total_sum: number;
  menu_discount_sum: number;
  promotion_discount_sum: number;
  voucher_discount_sum: number;
}

export function sumSalesOpsDaily(rows: SalesOpsDailyLike[]): SalesOpsSum {
  return rows.reduce<SalesOpsSum>(
    (acc, r) => ({
      trans_count_all: acc.trans_count_all + (r.trans_count_all ?? 0),
      trans_count_finished: acc.trans_count_finished + (r.trans_count_finished ?? 0),
      cancelled_count: acc.cancelled_count + (r.cancelled_count ?? 0),
      void_count: acc.void_count + (r.void_count ?? 0),
      new_count: acc.new_count + (r.new_count ?? 0),
      dwell_seconds_sum: acc.dwell_seconds_sum + (r.dwell_seconds_sum ?? 0),
      dwell_sample_count: acc.dwell_sample_count + (r.dwell_sample_count ?? 0),
      pax_total_sum: acc.pax_total_sum + (r.pax_total_sum ?? 0),
      menu_discount_sum: acc.menu_discount_sum + (r.menu_discount_sum ?? 0),
      promotion_discount_sum: acc.promotion_discount_sum + (r.promotion_discount_sum ?? 0),
      voucher_discount_sum: acc.voucher_discount_sum + (r.voucher_discount_sum ?? 0),
    }),
    {
      trans_count_all: 0,
      trans_count_finished: 0,
      cancelled_count: 0,
      void_count: 0,
      new_count: 0,
      dwell_seconds_sum: 0,
      dwell_sample_count: 0,
      pax_total_sum: 0,
      menu_discount_sum: 0,
      promotion_discount_sum: 0,
      voucher_discount_sum: 0,
    }
  );
}

interface SalesChannelLike {
  channel: string | null;
  revenue: number | null;
  trans_count: number | null;
}

export function groupByChannel(rows: SalesChannelLike[]): { channel: string; revenue: number; trans_count: number }[] {
  const map = new Map<string, { revenue: number; trans_count: number }>();
  for (const r of rows) {
    const key = r.channel ?? "Tidak Diketahui";
    const e = map.get(key) ?? { revenue: 0, trans_count: 0 };
    e.revenue += r.revenue ?? 0;
    e.trans_count += r.trans_count ?? 0;
    map.set(key, e);
  }
  return [...map.entries()]
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .map(([channel, v]) => ({ channel, ...v }));
}

interface SalesPaymentMethodLike {
  payment_method_type_name: string | null;
  payment_amount: number | null;
  payment_count: number | null;
}

export function groupByPaymentMethod(
  rows: SalesPaymentMethodLike[]
): { payment_method_type_name: string; payment_amount: number; payment_count: number }[] {
  const map = new Map<string, { payment_amount: number; payment_count: number }>();
  for (const r of rows) {
    const key = r.payment_method_type_name ?? "Tidak Diketahui";
    const e = map.get(key) ?? { payment_amount: 0, payment_count: 0 };
    e.payment_amount += r.payment_amount ?? 0;
    e.payment_count += r.payment_count ?? 0;
    map.set(key, e);
  }
  return [...map.entries()]
    .sort(([, a], [, b]) => b.payment_amount - a.payment_amount)
    .map(([payment_method_type_name, v]) => ({ payment_method_type_name, ...v }));
}
