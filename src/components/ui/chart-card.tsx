import { cn } from "@/lib/cn";

export function ChartCard({
  title,
  children,
  fullWidth,
  className,
  headerExtra,
}: {
  title: string;
  children: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  headerExtra?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-[14px] p-5",
        fullWidth && "col-span-full",
        className
      )}
    >
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="text-sm font-bold text-text">{title}</div>
        {headerExtra}
      </div>
      {children}
    </div>
  );
}
