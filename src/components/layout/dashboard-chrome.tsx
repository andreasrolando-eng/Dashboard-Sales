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
        onToggleCollapse={() => {
          if (window.matchMedia("(min-width: 1024px)").matches) writeCollapsed(!collapsed);
          else setOpen((o) => !o);
        }}
      />

      <div
        className={cn(
          "py-4 pr-4 pl-[88px] lg:py-8 lg:pr-10 transition-[padding] duration-200",
          collapsed ? "lg:pl-[112px]" : "lg:pl-[280px]"
        )}
      >
        {children}
      </div>
    </div>
  );
}
