import type { Database } from "@/types/database.types";
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
      // Simulates grand_total - tax/vat - discount/voucher - platform fee - other cost - delivery: roughly 18-25% deducted.
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
  category?: string | null
): SalesProductRow[] {
  const products = category ? PRODUCTS.filter((p) => p.category === category) : PRODUCTS;
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
          category: p.category,
          qty,
          revenue: qty * p.basePrice,
        });
      });
    });
  });
  return rows;
}

export function mockMenuPerformance(
  dateStart: string,
  dateEnd: string,
  outlet: string | null,
  category: string | null,
  threshold: number
): MenuPerfRow[] {
  const days = daysBetween(dateStart, dateEnd);
  const prevEnd = shiftDate(dateStart, -1);
  const prevStart = shiftDate(prevEnd, -(days - 1));

  const current = mockSalesProductDaily(dateStart, dateEnd, outlet, null);
  const previous = mockSalesProductDaily(prevStart, prevEnd, outlet, null);

  const curAgg = new Map<string, { menu_name: string | null; category: string | null; qty: number; revenue: number }>();
  for (const r of current) {
    const e = curAgg.get(r.menu_id) ?? { menu_name: r.menu_name, category: r.category, qty: 0, revenue: 0 };
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
    .filter(([, e]) => !category || e.category === category)
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
      return {
        member_code: m.member_code,
        member_name: m.member_name,
        outlet_name: outletName(m.branch_code),
        tier: m.tier,
        visits,
        spending,
      };
    })
    .sort((a, b) => b.spending - a.spending)
    .slice(0, limit);
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
  return [...new Set(PRODUCTS.map((p) => p.category))].map((category) => ({ category }));
}

export function mockLastSync() {
  return { job_name: "sync-esb", finished_at: new Date().toISOString(), status: "success", rows_synced: 1240 };
}
