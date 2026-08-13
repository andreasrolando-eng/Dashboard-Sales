export function KpiCard({
  label,
  value,
  delta,
  deltaColor,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaColor?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-[14px] px-5 py-[18px]">
      <div className="text-[13px] text-text-secondary font-medium mb-2.5">{label}</div>
      <div className="text-2xl font-bold text-text">{value}</div>
      {delta && (
        <div className="text-xs font-semibold mt-2" style={{ color: deltaColor }}>
          {delta}
        </div>
      )}
    </div>
  );
}
