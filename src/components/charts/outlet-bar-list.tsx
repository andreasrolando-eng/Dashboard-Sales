export function OutletBarList({
  items,
}: {
  items: { name: string; valueLabel: string; pct: number }[];
}) {
  return (
    <div>
      {items.map((o) => (
        <div key={o.name} className="mb-3 last:mb-0">
          <div className="flex justify-between text-xs mb-[5px]">
            <span className="font-medium text-text">{o.name}</span>
            <span className="text-text-secondary">{o.valueLabel}</span>
          </div>
          <div className="h-2 bg-track rounded-full">
            <div className="h-full bg-accent rounded-full" style={{ width: `${Math.max(0, Math.min(100, o.pct))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
