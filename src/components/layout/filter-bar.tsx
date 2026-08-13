"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ALL_CATEGORIES, ALL_OUTLETS, useDashboardFilters } from "@/lib/use-dashboard-filters";
import { getCategoryOptions, getOutletOptions } from "@/lib/queries/meta";
import { fmtDateID, toISODate } from "@/lib/format";

export function FilterBar() {
  const { outlet, category, dateStart, dateEnd, setOutlet, setCategory, setDateStart, setDateEnd } =
    useDashboardFilters();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: outlets } = useQuery({ queryKey: ["outlet-options"], queryFn: getOutletOptions });
  const { data: categories } = useQuery({ queryKey: ["category-options"], queryFn: getCategoryOptions });

  const today = toISODate(new Date());
  const selectClass =
    "px-3.5 py-2.5 rounded-[10px] border border-border-form bg-surface text-[13px] font-medium text-text";

  return (
    <div className="flex flex-wrap gap-2.5 mb-6">
      <select value={outlet} onChange={(e) => setOutlet(e.target.value)} className={selectClass}>
        <option value={ALL_OUTLETS}>{ALL_OUTLETS}</option>
        {outlets?.map((o) => (
          <option key={o.branch_code} value={o.branch_code}>
            {o.branch_name}
          </option>
        ))}
      </select>

      <div className="relative">
        <div
          onClick={() => setPickerOpen((v) => !v)}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-surface border border-border-form rounded-[10px] text-[13px] font-medium cursor-pointer select-none"
        >
          <div className="w-2 h-2 rounded-sm bg-accent" />
          {fmtDateID(dateStart)} – {fmtDateID(dateEnd)}
        </div>

        {pickerOpen && (
          <div className="absolute top-[calc(100%+6px)] left-0 bg-surface border border-border-form rounded-xl p-4 shadow-[var(--shadow-popover)] z-20 flex flex-col gap-3 min-w-[260px]">
            <div>
              <label className="block text-xs font-semibold text-text-label mb-[5px]">Dari tanggal</label>
              <input
                type="date"
                value={dateStart}
                max={dateEnd}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full box-border px-2.5 py-2 rounded-lg border border-border-form text-[13px] font-sans"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-label mb-[5px]">Sampai tanggal</label>
              <input
                type="date"
                value={dateEnd}
                min={dateStart}
                max={today}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full box-border px-2.5 py-2 rounded-lg border border-border-form text-[13px] font-sans"
              />
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="py-[9px] rounded-lg border-none bg-accent text-white text-[13px] font-semibold cursor-pointer"
            >
              Terapkan
            </button>
          </div>
        )}
      </div>

      <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
        <option value={ALL_CATEGORIES}>{ALL_CATEGORIES}</option>
        {categories?.map(
          (c) =>
            c.category && (
              <option key={c.category} value={c.category}>
                {c.category}
              </option>
            )
        )}
      </select>
    </div>
  );
}
