import { pctDelta } from "@/lib/period";

interface OutletRevenue {
  branch_code: string;
  branch_name: string;
  revenue: number;
}

/**
 * One-sentence auto-narrative for the Overview tab: overall revenue delta vs
 * the previous period, plus whichever outlet contributed most to that move
 * (largest absolute revenue swing in the same direction as the overall
 * change -- not largest %, since a near-zero-revenue outlet can swing 500%
 * without being what actually moved the topline).
 */
export function buildOverviewInsight(
  current: { revenue: number },
  previous: { revenue: number },
  currentByOutlet: OutletRevenue[],
  previousByOutlet: OutletRevenue[]
): string {
  const pct = pctDelta(current.revenue, previous.revenue);
  if (pct === null) {
    return "Belum ada data revenue periode sebelumnya untuk dibandingkan.";
  }

  const direction = pct >= 0 ? "naik" : "turun";
  const headline = `Revenue ${direction} ${Math.abs(pct).toFixed(1)}% dibanding periode sebelumnya`;

  const prevByCode = new Map(previousByOutlet.map((o) => [o.branch_code, o.revenue]));
  let driver: { branch_name: string; diff: number; pct: number | null } | null = null;

  for (const o of currentByOutlet) {
    const prevRevenue = prevByCode.get(o.branch_code) ?? 0;
    const diff = o.revenue - prevRevenue;
    const sameDirection = pct >= 0 ? diff > 0 : diff < 0;
    if (!sameDirection) continue;
    if (!driver || Math.abs(diff) > Math.abs(driver.diff)) {
      driver = { branch_name: o.branch_name, diff, pct: pctDelta(o.revenue, prevRevenue) };
    }
  }

  if (!driver) return `${headline}.`;

  const driverDirection = pct >= 0 ? "kenaikan" : "penurunan";
  const driverPctText = driver.pct !== null ? ` (${driver.pct >= 0 ? "+" : ""}${driver.pct.toFixed(1)}%)` : "";
  return `${headline}, didorong ${driverDirection} di outlet ${driver.branch_name}${driverPctText}.`;
}
