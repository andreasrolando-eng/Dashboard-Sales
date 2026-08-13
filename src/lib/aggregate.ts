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
