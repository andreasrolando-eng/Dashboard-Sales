"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { CHART_COLORS } from "@/lib/chart-colors";
import { fmtDateShortID, fmtDayShortID, isWeekendISO } from "@/lib/format";

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Two-line axis tick for date-keyed bars: date on top, day-of-week name
 * below. Weekends stand out by weight/contrast (bold + darker ink), never by
 * hue -- a status color (red/green) would misread as "this day is bad".
 */
function DateAxisTick({ x, y, payload }: { x?: string | number; y?: string | number; payload?: { value?: string | number } }) {
  const iso = String(payload?.value ?? "");
  const weekend = isWeekendISO(iso);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={13} textAnchor="middle" fontSize={10} fill={CHART_COLORS.textTertiary}>
        {fmtDateShortID(iso)}
      </text>
      <text
        x={0}
        y={0}
        dy={26}
        textAnchor="middle"
        fontSize={9}
        fontWeight={weekend ? 700 : 500}
        fill={weekend ? CHART_COLORS.textSecondary : CHART_COLORS.textTertiary}
      >
        {fmtDayShortID(iso)}
      </text>
    </g>
  );
}

export function SimpleBarChart({
  data,
  height = 160,
  showAxisLabels = false,
  /** Bars are keyed by ISO date -- renders the two-line date+day-name tick (see DateAxisTick) instead of the plain label, and implies showAxisLabels. */
  dateAxis = false,
  valueFormatter,
  labelFormatter,
}: {
  data: BarDatum[];
  height?: number;
  showAxisLabels?: boolean;
  dateAxis?: boolean;
  valueFormatter?: (value: number) => string;
  /** Formats the tooltip header shown on hover (e.g. ISO date -> "15 Jul 2026"). Falls back to the raw label. */
  labelFormatter?: (label: string) => string;
}) {
  // Past ~20 daily bars, a two-line tick under every single one starts to
  // crowd its neighbors. Thin to every other tick rather than let the text
  // overlap -- every bar still renders, and the skipped days' date+day still
  // land in the tooltip on hover.
  const tickInterval = dateAxis && data.length > 20 ? 1 : 0;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="30%">
        {/* Always present (even when not visually shown) so the Tooltip has a
            real category label to show on hover instead of a bare index. */}
        <XAxis
          dataKey="label"
          hide={!showAxisLabels && !dateAxis}
          axisLine={false}
          tickLine={false}
          interval={dateAxis ? tickInterval : 0}
          height={dateAxis ? 40 : 30}
          tick={dateAxis ? DateAxisTick : { fontSize: 9, fill: CHART_COLORS.textTertiary }}
        />
        <Tooltip
          cursor={{ fill: CHART_COLORS.track, radius: 4 }}
          separator=""
          formatter={(value) => {
            const n = Number(value);
            return [valueFormatter ? valueFormatter(n) : n.toLocaleString("id-ID"), ""];
          }}
          labelFormatter={(label) => (labelFormatter ? labelFormatter(String(label)) : String(label))}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: `1px solid ${CHART_COLORS.border}`,
            boxShadow: "0 4px 16px oklch(0% 0 0 / 0.08)",
          }}
          labelStyle={{ color: CHART_COLORS.textSecondary, fontWeight: 600, marginBottom: 2 }}
          itemStyle={{ color: CHART_COLORS.text, fontWeight: 700, padding: 0 }}
        />
        <Bar
          dataKey="value"
          fill={CHART_COLORS.accent}
          radius={[4, 4, 0, 0]}
          maxBarSize={22}
          isAnimationActive={false}
          activeBar={{ fill: CHART_COLORS.accent, fillOpacity: 0.75 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
