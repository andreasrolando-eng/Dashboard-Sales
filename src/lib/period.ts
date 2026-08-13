import { toISODate } from "@/lib/format";

/** Immediately preceding period of equal length -- same convention as fn_menu_performance's trend comparison. */
export function getPreviousPeriod(dateStart: string, dateEnd: string): { prevStart: string; prevEnd: string } {
  const days = Math.round((new Date(dateEnd).getTime() - new Date(dateStart).getTime()) / 86_400_000) + 1;
  const prevEndDate = new Date(dateStart);
  prevEndDate.setDate(prevEndDate.getDate() - 1);
  const prevStartDate = new Date(prevEndDate);
  prevStartDate.setDate(prevStartDate.getDate() - (days - 1));
  return { prevStart: toISODate(prevStartDate), prevEnd: toISODate(prevEndDate) };
}

export function pctDelta(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/** FR-6 WoW/MoM style delta label. `invert` for metrics where a decrease is the good direction (e.g. churn). */
export function deltaLabel(
  pct: number | null,
  opts?: { invert?: boolean; suffix?: string }
): { text: string; color: string } {
  const suffix = opts?.suffix ?? "vs periode lalu";
  if (pct === null) return { text: `Data periode lalu tidak tersedia`, color: "oklch(50% 0.01 260)" };
  const good = opts?.invert ? pct <= 0 : pct >= 0;
  const sign = pct >= 0 ? "+" : "";
  return { text: `${sign}${pct.toFixed(1)}% ${suffix}`, color: good ? "#16a34a" : "#dc2626" };
}
