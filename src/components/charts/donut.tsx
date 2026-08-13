import { CHART_COLORS } from "@/lib/chart-colors";

export function Donut({
  percent,
  centerValue,
  centerLabel,
  size = 120,
  holeSize = 80,
}: {
  percent: number;
  centerValue: string;
  centerLabel: string;
  size?: number;
  holeSize?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `conic-gradient(${CHART_COLORS.accent} 0% ${clamped}%, ${CHART_COLORS.trackInactive} ${clamped}% 100%)`,
      }}
      className="flex items-center justify-center shrink-0"
    >
      <div
        style={{ width: holeSize, height: holeSize }}
        className="rounded-full bg-surface flex flex-col items-center justify-center"
      >
        <div className="text-xl font-bold text-text">{centerValue}</div>
        <div className="text-[10px] text-text-secondary">{centerLabel}</div>
      </div>
    </div>
  );
}
