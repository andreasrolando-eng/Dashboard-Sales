"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { CHART_COLORS } from "@/lib/chart-colors";

export interface BarDatum {
  label: string;
  value: number;
}

export function SimpleBarChart({
  data,
  height = 160,
  showAxisLabels = false,
  valueFormatter,
  labelFormatter,
}: {
  data: BarDatum[];
  height?: number;
  showAxisLabels?: boolean;
  valueFormatter?: (value: number) => string;
  /** Formats the tooltip header shown on hover (e.g. ISO date -> "15 Jul 2026"). Falls back to the raw label. */
  labelFormatter?: (label: string) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        {/* Always present (even when not visually shown) so the Tooltip has a
            real category label to show on hover instead of a bare index. */}
        <XAxis
          dataKey="label"
          hide={!showAxisLabels}
          axisLine={false}
          tickLine={false}
          interval={0}
          tick={{ fontSize: 9, fill: CHART_COLORS.textTertiary }}
        />
        <Tooltip
          cursor={false}
          formatter={(value) => {
            const n = Number(value);
            return [valueFormatter ? valueFormatter(n) : n.toLocaleString("id-ID"), ""];
          }}
          labelFormatter={(label) => (labelFormatter ? labelFormatter(String(label)) : String(label))}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${CHART_COLORS.border}` }}
        />
        <Bar dataKey="value" fill={CHART_COLORS.accent} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
