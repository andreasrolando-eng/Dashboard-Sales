// Literal color values for use inside SVG/inline-style chart contexts
// (Recharts, conic-gradient) -- kept separate from the CSS var tokens in
// globals.css so chart libraries never depend on var() resolution inside
// SVG presentation attributes.
export const CHART_COLORS = {
  accent: "#2563eb",
  positive: "#16a34a",
  negative: "#dc2626",
  track: "oklch(93% 0.005 260)",
  trackInactive: "oklch(90% 0.005 260)",
  text: "oklch(22% 0.01 260)",
  textSecondary: "oklch(50% 0.01 260)",
  textTertiary: "oklch(55% 0.01 260)",
  border: "oklch(91% 0.005 260)",
} as const;
