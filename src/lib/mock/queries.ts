import type { Database } from "@/types/database.types";
import type { SalesBill } from "@/lib/queries/sales";
import { dateRange, MEMBERS, OUTLETS, PEAK_HOUR_WEIGHT, PEAK_HOURS, PRODUCTS, PROMOTIONS, seededRandom } from "./fixtures";

type SalesDailyRow = Database["public"]["Views"]["v_sales_daily_outlet"]["Row"];
type SalesHourlyRow = Database["public"]["Views"]["v_sales_hourly_outlet"]["Row"];
type SalesProductRow = Database["public"]["Views"]["v_sales_product_daily"]["Row"];
type MenuPerfRow = Database["public"]["Functions"]["fn_menu_performance"]["Returns"][number];
type PromoPerfRow = Database["public"]["Functions"]["fn_promo_performance"]["Returns"][number];
type MembershipSummaryRow = Database["public"]["Functions"]["fn_membership_summary"]["Returns"][number];
type TopMemberRow = Database["public"]["Functions"]["fn_top_members"]["Returns"][number];

const OUTLET_WEIGHT: Record<string, number> = { SNY: 1.4, KMG: 1.15, PIK: 1.55, BDG: 0.85, SBY: 0.95 };

function daysBetween(start: string, end: string): number {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function scopedOutlets(outlet?: string | null) {
  return outlet ? OUTLETS.filter((o) => o.branch_code === outlet) : OUTLETS;
}

export function mockSalesDailyOutlet(dateStart: string, dateEnd: string, outlet?: string | null): SalesDailyRow[] {
  const rows: SalesDailyRow[] = [];
  dateRange(dateStart, dateEnd).forEach((date, di) => {
    const weekday = new Date(date).getDay();
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.25 : 1;
    scopedOutlets(outlet).forEach((o) => {
      const seed = di * 97 + o.branch_code.charCodeAt(0) * 13;
      const noise = 0.85 + seededRandom(seed) * 0.3;
      const revenue = Math.round(4_200_000 * OUTLET_WEIGHT[o.branch_code] * weekendBoost * noise);
      const trans = Math.max(1, Math.round(revenue / 56_000));
      const memberShare = 0.55 + seededRandom(seed + 1) * 0.15;
      const promoShare = 0.18 + seededRandom(seed + 2) * 0.1;
      // Simulates subtotal - tax/vat - discount - rounding: roughly 18-25% deducted.
      const nettShare = 0.75 + seededRandom(seed + 3) * 0.07;
      rows.push({
        sales_date: date,
        branch_code: o.branch_code,
        revenue,
        nett_sales: Math.round(revenue * nettShare),
        trans_count: trans,
        member_revenue: Math.round(revenue * memberShare),
        non_promo_revenue: Math.round(revenue * (1 - promoShare)),
        non_promo_trans_count: Math.round(trans * (1 - promoShare)),
      });
    });
  });
  return rows;
}

export function mockSalesHourlyOutlet(dateStart: string, dateEnd: string, outlet?: string | null): SalesHourlyRow[] {
  const rows: SalesHourlyRow[] = [];
  dateRange(dateStart, dateEnd).forEach((date, di) => {
    scopedOutlets(outlet).forEach((o) => {
      PEAK_HOURS.forEach((hour) => {
        const seed = di * 31 + hour * 7 + o.branch_code.charCodeAt(0);
        const noise = 0.8 + seededRandom(seed) * 0.4;
        const revenue = Math.round(180_000 * OUTLET_WEIGHT[o.branch_code] * PEAK_HOUR_WEIGHT[hour] * noise);
        rows.push({
          sales_date: date,
          branch_code: o.branch_code,
          hour_of_day: hour,
          revenue,
          trans_count: Math.max(0, Math.round(revenue / 56_000)),
        });
      });
    });
  });
  return rows;
}

export function mockSalesProductDaily(
  dateStart: string,
  dateEnd: string,
  outlet?: string | null,
  categoryId?: string | null,
  categoryDetailId?: string | null
): SalesProductRow[] {
  let products = categoryId ? PRODUCTS.filter((p) => p.category_id === categoryId) : PRODUCTS;
  if (categoryDetailId) products = products.filter((p) => p.category_detail_id === categoryDetailId);
  const rows: SalesProductRow[] = [];
  dateRange(dateStart, dateEnd).forEach((date, di) => {
    scopedOutlets(outlet).forEach((o) => {
      products.forEach((p) => {
        const seed = di * 17 + p.menu_id.charCodeAt(1) * 11 + o.branch_code.charCodeAt(0);
        const noise = 0.6 + seededRandom(seed) * 0.8;
        const qty = Math.max(0, Math.round((p.baseQty / 30) * OUTLET_WEIGHT[o.branch_code] * noise));
        if (qty === 0) return;
        rows.push({
          sales_date: date,
          branch_code: o.branch_code,
          menu_id: p.menu_id,
          menu_name: p.menu_name,
          category_id: p.category_id,
          category: p.category,
          category_detail_id: p.category_detail_id,
          category_detail: p.category_detail,
          qty,
          revenue: qty * p.basePrice,
        });
      });
    });
  });
  return rows;
}

/** Deterministic per-day bill count + amounts, matching the real bill_num shape `{branch_code}{YYYYMMDD}{seq}`. Generates the full range then paginates client-side, mirroring what getSalesBills does against v_sales_bills. */
export function mockSalesBills(
  dateStart: string,
  dateEnd: string,
  outlet: string | null,
  page: number,
  pageSize: number
): { rows: SalesBill[]; totalCount: number } {
  const rows: SalesBill[] = [];
  dateRange(dateStart, dateEnd).forEach((date, di) => {
    const weekday = new Date(date).getDay();
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.25 : 1;
    scopedOutlets(outlet).forEach((o) => {
      const seed = di * 97 + o.branch_code.charCodeAt(0) * 13;
      const billCount = Math.max(1, Math.round(6 * OUTLET_WEIGHT[o.branch_code] * weekendBoost * (0.6 + seededRandom(seed) * 0.8)));
      const dateCompact = date.replace(/-/g, "");
      for (let seq = 1; seq <= billCount; seq++) {
        const billSeed = seed + seq * 7;
        const noise = 0.5 + seededRandom(billSeed) * 1.5;
        rows.push({
          bill_num: `${o.branch_code}${dateCompact}${String(seq).padStart(4, "0")}`,
          sales_date: date,
          branch_code: o.branch_code,
          grand_total: Math.round(56_000 * noise),
        });
      }
    });
  });

  rows.sort((a, b) => a.sales_date.localeCompare(b.sales_date) || a.bill_num.localeCompare(b.bill_num));

  const from = (page - 1) * pageSize;
  return { rows: rows.slice(from, from + pageSize), totalCount: rows.length };
}

/** Mock equivalent of v_sales_daily_outlet_category: filtered products' revenue, plus a simulated nett_sales share (mock has no per-transaction data to allocate from proportionally, unlike the real view). */
export function mockSalesDailyOutletCategory(
  dateStart: string,
  dateEnd: string,
  outlet?: string | null,
  categoryId?: string | null,
  categoryDetailId?: string | null
): { sales_date: string; branch_code: string; revenue: number; nett_sales: number }[] {
  const productRows = mockSalesProductDaily(dateStart, dateEnd, outlet, categoryId, categoryDetailId);
  const map = new Map<string, { sales_date: string; branch_code: string; revenue: number }>();
  for (const r of productRows) {
    const key = `${r.sales_date}|${r.branch_code}`;
    const e = map.get(key) ?? { sales_date: r.sales_date, branch_code: r.branch_code, revenue: 0 };
    e.revenue += r.revenue ?? 0;
    map.set(key, e);
  }
  return [...map.values()].map((e, i) => {
    const seed = e.sales_date.length * 97 + e.branch_code.charCodeAt(0) * 13 + i;
    const nettShare = 0.75 + seededRandom(seed + 3) * 0.07;
    return { ...e, nett_sales: Math.round(e.revenue * nettShare) };
  });
}

export function mockMenuPerformance(
  dateStart: string,
  dateEnd: string,
  outlet: string | null,
  categoryId: string | null,
  categoryDetailId: string | null,
  threshold: number
): MenuPerfRow[] {
  const days = daysBetween(dateStart, dateEnd);
  const prevEnd = shiftDate(dateStart, -1);
  const prevStart = shiftDate(prevEnd, -(days - 1));

  const current = mockSalesProductDaily(dateStart, dateEnd, outlet, null, null);
  const previous = mockSalesProductDaily(prevStart, prevEnd, outlet, null, null);

  const curAgg = new Map<
    string,
    { category_id: string | null; category: string | null; category_detail_id: string | null; category_detail: string | null; menu_name: string | null; qty: number; revenue: number }
  >();
  for (const r of current) {
    const e =
      curAgg.get(r.menu_id) ??
      {
        menu_name: r.menu_name,
        category_id: r.category_id,
        category: r.category,
        category_detail_id: r.category_detail_id,
        category_detail: r.category_detail,
        qty: 0,
        revenue: 0,
      };
    e.qty += r.qty ?? 0;
    e.revenue += r.revenue ?? 0;
    curAgg.set(r.menu_id, e);
  }
  const prevAgg = new Map<string, number>();
  for (const r of previous) {
    prevAgg.set(r.menu_id, (prevAgg.get(r.menu_id) ?? 0) + (r.qty ?? 0));
  }

  const totalRevenue = [...curAgg.values()].reduce((a, e) => a + e.revenue, 0);

  return [...curAgg.entries()]
    .filter(([, e]) => !categoryId || e.category_id === categoryId)
    .filter(([, e]) => !categoryDetailId || e.category_detail_id === categoryDetailId)
    .map(([menu_id, e]) => {
      const prevQty = prevAgg.get(menu_id);
      let trend: MenuPerfRow["trend"] = "stagnan";
      if (prevQty != null) {
        if (e.qty > prevQty * 1.1) trend = "naik";
        else if (e.qty < prevQty * 0.9) trend = "turun";
      }
      return {
        menu_id,
        menu_name: e.menu_name,
        category: e.category,
        category_detail: e.category_detail,
        qty: e.qty,
        revenue: e.revenue,
        contribution_pct: totalRevenue > 0 ? Math.round((e.revenue / totalRevenue) * 1000) / 10 : 0,
        trend,
        is_takeout_candidate: e.qty < threshold,
      };
    })
    .sort((a, b) => a.qty - b.qty);
}

export function mockPromoPerformance(dateStart: string, dateEnd: string, _outlet: string | null): PromoPerfRow[] {
  const days = daysBetween(dateStart, dateEnd);
  const baselineAvg = 58_000;

  return PROMOTIONS.map((p, i) => {
    const seed = i * 53 + days;
    const noise = 0.8 + seededRandom(seed) * 0.4;
    const redemptions = Math.max(1, Math.round(p.redemptionsPerDay * days * noise));
    const liftFactor = 1 + (0.05 + seededRandom(seed + 1) * 0.35);
    const avgPromoBill = Math.round(baselineAvg * liftFactor);
    const promo_revenue = redemptions * avgPromoBill;
    const discountPerBill = Math.round(avgPromoBill * (0.1 + seededRandom(seed + 2) * 0.15));
    const discount_cost = redemptions * discountPerBill;
    const lift_pct = Math.round(((avgPromoBill - baselineAvg) / baselineAvg) * 1000) / 10;
    const roi = discount_cost > 0 ? Math.round(((promo_revenue - redemptions * baselineAvg) / discount_cost) * 100) / 100 : 0;

    return {
      promotion_id: p.promotion_id,
      promotion_name: p.promotion_name,
      redemptions,
      promo_revenue,
      discount_cost,
      lift_pct,
      roi,
      status: (lift_pct >= 15 && roi >= 2 ? "Efektif" : "Kurang Efektif") as PromoPerfRow["status"],
    };
  }).sort((a, b) => b.redemptions - a.redemptions);
}

export function mockMembershipSummary(
  _dateStart: string,
  _dateEnd: string,
  outlet: string | null
): MembershipSummaryRow[] {
  const scoped = outlet ? MEMBERS.filter((m) => m.branch_code === outlet) : MEMBERS;
  const total = scoped.length || 1;
  const active = Math.max(1, Math.round(total * 0.75));
  return [
    {
      total_members: total,
      active_members: active,
      active_pct: Math.round((active / total) * 1000) / 10,
      churn_pct: Math.round((1 - active / total) * 1000) / 10,
      retention_pct: 68.5,
      visit_frequency: 3.2,
    },
  ];
}

export function mockTopMembers(
  dateStart: string,
  _dateEnd: string,
  outlet: string | null,
  limit = 8
): TopMemberRow[] {
  const scoped = outlet ? MEMBERS.filter((m) => m.branch_code === outlet) : MEMBERS;
  const outletName = (code: string) => OUTLETS.find((o) => o.branch_code === code)?.branch_name ?? code;

  return scoped
    .map((m, i) => {
      const seed = i * 19 + dateStart.length;
      const visits = 15 + Math.round(seededRandom(seed) * 20);
      const spending = visits * (180_000 + Math.round(seededRandom(seed + 1) * 300_000));
      const favIdx = Math.floor(seededRandom(seed + 2) * PRODUCTS.length);
      return {
        member_code: m.member_code,
        member_name: m.member_name,
        outlet_name: outletName(m.branch_code),
        tier: m.tier,
        visits,
        spending,
        favorite_menu: PRODUCTS[favIdx].menu_name,
      };
    })
    .sort((a, b) => b.spending - a.spending)
    .slice(0, limit);
}

export function mockMemberOptions(outlet: string | null): { member_code: string; member_name: string }[] {
  const scoped = outlet ? MEMBERS.filter((m) => m.branch_code === outlet) : MEMBERS;
  return scoped.map((m) => ({ member_code: m.member_code, member_name: m.member_name }));
}

/** Deterministic per-member "shopping basket" -- a stable subset of PRODUCTS, sized/ordered by a seed derived from the member's index. */
export function mockMemberMenuPurchases(
  memberCode: string,
  dateStart: string,
  dateEnd: string,
  _outlet: string | null
): { menu_id: string; menu_name: string; qty: number; revenue: number; last_purchase_date: string }[] {
  const memberIdx = Math.max(0, MEMBERS.findIndex((m) => m.member_code === memberCode));
  const days = dateRange(dateStart, dateEnd);
  const itemCount = 4 + (memberIdx % 3);

  return PRODUCTS.map((p, i) => ({ p, seed: memberIdx * 31 + i * 13 }))
    .sort((a, b) => seededRandom(a.seed) - seededRandom(b.seed))
    .slice(0, itemCount)
    .map(({ p, seed }) => {
      const qty = 2 + Math.round(seededRandom(seed + 1) * 10);
      const dayIdx = Math.min(days.length - 1, Math.floor(seededRandom(seed + 2) * days.length));
      return {
        menu_id: p.menu_id,
        menu_name: p.menu_name,
        qty,
        revenue: qty * p.basePrice,
        last_purchase_date: days[dayIdx] ?? dateEnd,
      };
    })
    .sort((a, b) => b.qty - a.qty);
}

export function mockMembershipNewWeekly(dateEnd: string) {
  const base = [42, 38, 51, 47, 60, 55, 63, 58];
  const end = new Date(dateEnd);
  return base.map((v, i) => {
    const weekStart = new Date(end);
    weekStart.setDate(weekStart.getDate() - 7 * (base.length - 1 - i));
    return { week_start: weekStart.toISOString().slice(0, 10), new_members: v };
  });
}

export function mockOutletOptions() {
  return OUTLETS;
}

export function mockCategoryOptions() {
  const seen = new Map<string, string | null>();
  for (const p of PRODUCTS) if (!seen.has(p.category_id)) seen.set(p.category_id, p.category);
  return [...seen.entries()].map(([category_id, category_name]) => ({ category_id, category_name }));
}

export function mockCategoryDetailOptions() {
  const seen = new Map<string, { category_detail_name: string | null; category_id: string | null }>();
  for (const p of PRODUCTS) if (!seen.has(p.category_detail_id)) seen.set(p.category_detail_id, { category_detail_name: p.category_detail, category_id: p.category_id });
  return [...seen.entries()].map(([category_detail_id, v]) => ({ category_detail_id, ...v }));
}

export function mockLastSync() {
  return { job_name: "sync-esb", finished_at: new Date().toISOString(), status: "success", rows_synced: 1240 };
}
