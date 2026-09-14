"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface DropdownOption {
  value: string;
  label: React.ReactNode;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-text-tertiary shrink-0 transition-transform duration-150", open && "rotate-180")}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Native `<select>` replacement -- browsers render an open `<select>`'s
 * option list with OS/browser chrome that CSS can't restyle, which made it
 * clash with the rest of the (custom-styled) dashboard. `className` is
 * expected to carry the same padding/border/text-size classes every call
 * site already had on its native `<select>` (e.g. `selectClass` in
 * FilterBar/panel components) -- this component only adds the trigger's
 * flex layout and cursor/disabled states on top, so it never has to fight
 * caller-supplied sizing for Tailwind specificity.
 */
export function Dropdown({
  value,
  options,
  onChange,
  disabled,
  placeholder = "Pilih",
  className,
  panelClassName,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronIcon open={open} />
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          className={cn(
            "absolute top-[calc(100%+6px)] left-0 min-w-full w-max max-w-[min(85vw,280px)] bg-surface border border-border-form rounded-xl shadow-[var(--shadow-popover)] z-20 py-1.5 max-h-[280px] overflow-y-auto",
            panelClassName
          )}
        >
          {options.length === 0 ? (
            <div className="px-3.5 py-2 text-[13px] text-text-tertiary truncate">Tidak ada pilihan</div>
          ) : (
            options.map((o) => {
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "block w-full text-left truncate px-3.5 py-2 text-[13px] font-medium cursor-pointer",
                    isSelected ? "bg-accent-soft text-accent font-semibold" : "text-text hover:bg-hover"
                  )}
                >
                  {o.label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
