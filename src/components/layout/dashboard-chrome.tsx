"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Sidebar } from "./sidebar";

export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-page-bg text-text">
      <div
        onClick={() => setOpen(false)}
        className={cn("fixed inset-0 z-[15] bg-overlay lg:hidden", open ? "block" : "hidden")}
      />

      <Sidebar open={open} onNavigate={() => setOpen(false)} />

      <div className="p-4 lg:px-10 lg:py-8 lg:ml-[240px]">
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
