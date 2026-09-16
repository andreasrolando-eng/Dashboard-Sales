"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { useDashboardFilters, type TabKey } from "@/lib/use-dashboard-filters";
import { LogoutButton } from "./logout-button";

const NAV_ITEMS: { key: TabKey; label: string; square: boolean }[] = [
  { key: "overview", label: "Overview", square: true },
  { key: "sales", label: "Sales", square: false },
  { key: "ops", label: "Operasional", square: false },
  { key: "membership", label: "Membership", square: false },
  { key: "marketing", label: "Marketing", square: true },
];

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { tab, setTab } = useDashboardFilters();

  return (
    <div
      className={cn(
        "fixed top-0 left-0 bottom-0 w-[240px] flex flex-col bg-surface border-r border-border p-4 py-6 box-border z-20 transition-transform duration-200 ease-in-out lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center gap-2.5 px-2 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- static asset from public/, no next/image usage elsewhere in the app */}
        <img src="/ESB-logo.png" alt="ESB Analytics" className="w-[30px] h-[30px] rounded-lg object-contain" />
        <div className="text-base font-bold text-text">ESB Analytics</div>
      </div>

      <nav>
        {NAV_ITEMS.map((item) => {
          const active = tab === item.key;
          return (
            <div
              key={item.key}
              onClick={() => {
                setTab(item.key);
                onNavigate();
              }}
              className="flex items-center gap-3 px-3 py-[11px] rounded-[10px] cursor-pointer mb-0.5"
              style={{
                background: active ? "var(--color-accent-soft)" : "transparent",
                color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
              }}
            >
              <div
                className="w-[9px] h-[9px]"
                style={{
                  borderRadius: item.square ? "2px" : "50%",
                  background: active ? "var(--color-accent)" : "var(--color-text-inactive-dot)",
                }}
              />
              <div className="text-sm" style={{ fontWeight: active ? 700 : 500 }}>
                {item.label}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-border">
        <Link
          href="/account/security"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-[11px] rounded-[10px] text-text-secondary hover:bg-hover text-sm font-medium"
        >
          <div className="w-[9px] h-[9px] rounded-sm bg-text-inactive-dot" />
          Keamanan
        </Link>
        <LogoutButton />
      </div>
    </div>
  );
}
