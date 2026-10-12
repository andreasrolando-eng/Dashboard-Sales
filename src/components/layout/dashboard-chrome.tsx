"use client";

import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Sidebar } from "./sidebar";

const COLLAPSED_KEY = "sidebar-collapsed";
const collapseListeners = new Set<() => void>();

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
  } catch {}
  collapseListeners.forEach((l) => l());
}

function subscribeCollapsed(listener: () => void) {
  collapseListeners.add(listener);
  return () => collapseListeners.delete(listener);
}

export function DashboardChrome({ children, isAdmin }: { children: React.ReactNode; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  // Server snapshot is always expanded; the stored preference applies after hydration.
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);

  return (
    <div className="min-h-screen bg-page-bg text-text">
      <div
        onClick={() => setOpen(false)}
        className={cn("fixed inset-0 z-[15] bg-overlay lg:hidden", open ? "block" : "hidden")}
      />

      <Sidebar
        open={open}
        onNavigate={() => setOpen(false)}
        isAdmin={isAdmin}
        collapsed={collapsed}
        onToggleCollapse={() => writeCollapsed(!collapsed)}
      />

      <div
        className={cn(
          "p-4 lg:px-10 lg:py-8 transition-[margin] duration-200",
          collapsed ? "lg:ml-[72px]" : "lg:ml-[240px]"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 cursor-pointer mb-4 lg:hidden bg-transparent border-none p-0"
        >
          <div className="flex flex-col gap-[3px]">
            <div className="w-5 h-0.5 bg-[oklch(30%_0.01_260)]" />
            <div className="w-5 h-0.5 bg-[oklch(30%_0.01_260)]" />
            <div className="w-5 h-0.5 bg-[oklch(30%_0.01_260)]" />
          </div>
          <div className="text-[13px] font-semibold text-[oklch(30%_0.01_260)]">Menu</div>
        </button>

        {children}
      </div>
    </div>
  );
}
