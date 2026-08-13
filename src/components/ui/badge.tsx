export function Badge({
  children,
  bg,
  color,
}: {
  children: React.ReactNode;
  bg: string;
  color: string;
}) {
  return (
    <span
      className="text-[11px] font-semibold px-[9px] py-[3px] rounded-md whitespace-nowrap"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}
