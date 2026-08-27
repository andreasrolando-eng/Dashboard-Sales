"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ALL_CATEGORIES, ALL_CATEGORY_DETAILS, ALL_OUTLETS, useDashboardFilters } from "@/lib/use-dashboard-filters";
import { getCategoryDetailOptions, getCategoryOptions, getOutletOptions } from "@/lib/queries/meta";
import { daysAgoLocalISO, firstOfMonthISO, fmtDateDMY, todayLocalISO } from "@/lib/format";
import { cn } from "@/lib/cn";

const WEEKDAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

interface YM {
  year: number;
  month: number;
}

interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

function ymdToISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addMonths({ year, month }: YM, delta: number): YM {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

function monthLabel({ year, month }: YM): string {
  return new Date(year, month, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

/** Full weeks (7-multiple) of cells for a month, padded with the previous/next month's trailing days. */
function buildMonthCells({ year, month }: YM): DayCell[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells: DayCell[] = [];

  for (let i = 0; i < firstWeekday; i++) {
    const day = daysInPrevMonth - firstWeekday + 1 + i;
    const prev = addMonths({ year, month }, -1);
    cells.push({ iso: ymdToISO(prev.year, prev.month, day), day, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: ymdToISO(year, month, day), day, inMonth: true });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const next = addMonths({ year, month }, 1);
    cells.push({ iso: ymdToISO(next.year, next.month, nextDay), day: nextDay, inMonth: false });
    nextDay++;
  }
  return cells;
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary shrink-0">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18" />
      <path d="M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

function MonthPanel({
  ym,
  today,
  rangeStart,
  rangeEnd,
  previewStart,
  previewEnd,
  hoverDate,
  onPrev,
  onNext,
  onDayClick,
  onDayDoubleClick,
  onDayHover,
}: {
  ym: YM;
  today: string;
  rangeStart: string;
  rangeEnd: string | null;
  /** Live start-to-cursor preview span while a range's start is picked but its end isn't yet -- purely visual, never applied. */
  previewStart: string | null;
  previewEnd: string | null;
  /** The actually-hovered cell (may be either end of previewStart/previewEnd when hovering backward past the pending start) -- drives the shadow ring specifically. */
  hoverDate: string | null;
  onPrev: () => void;
  onNext: () => void;
  onDayClick: (iso: string, disabled: boolean) => void;
  onDayDoubleClick: (iso: string, disabled: boolean) => void;
  onDayHover: (iso: string) => void;
}) {
  const cells = buildMonthCells(ym);
  return (
    <div className="flex-1 min-w-[224px]">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          aria-label="Bulan sebelumnya"
          onClick={onPrev}
          className="w-6 h-6 flex items-center justify-center rounded-md text-text-secondary hover:bg-hover cursor-pointer"
        >
          &lsaquo;
        </button>
        <div className="text-[13px] font-semibold text-text capitalize">{monthLabel(ym)}</div>
        <button
          type="button"
          aria-label="Bulan berikutnya"
          onClick={onNext}
          className="w-6 h-6 flex items-center justify-center rounded-md text-text-secondary hover:bg-hover cursor-pointer"
        >
          &rsaquo;
        </button>
      </div>
      <div className="grid grid-cols-7">
        {WEEKDAYS_ID.map((w) => (
          <div key={w} className="h-7 flex items-center justify-center text-[10px] font-semibold text-text-tertiary">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const disabled = cell.iso > today;
          const isStart = cell.iso === rangeStart;
          const isEnd = rangeEnd != null && cell.iso === rangeEnd;
          const inBand = rangeEnd != null && cell.iso >= rangeStart && cell.iso <= rangeEnd;
          const inPreview =
            !inBand && previewStart != null && previewEnd != null && cell.iso >= previewStart && cell.iso <= previewEnd;
          const isHoverCell = cell.iso === hoverDate && !isStart;
          const isToday = cell.iso === today;
          return (
            <div
              key={cell.iso}
              className={cn("h-8 flex items-center justify-center", (inBand || inPreview) && "bg-accent-soft")}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onDayClick(cell.iso, disabled)}
                onDoubleClick={() => onDayDoubleClick(cell.iso, disabled)}
                onMouseEnter={() => !disabled && onDayHover(cell.iso)}
                className={cn(
                  "h-8 w-8 rounded-full text-[12px] flex items-center justify-center transition-colors",
                  disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer",
                  !disabled && !isStart && !isEnd && "hover:bg-hover",
                  !cell.inMonth && !isStart && !isEnd && "text-text-tertiary",
                  cell.inMonth && !isStart && !isEnd && "text-text",
                  (isStart || isEnd) && "bg-accent text-white font-semibold",
                  isHoverCell && "shadow-[0_0_0_2px_var(--color-accent)]",
                  isToday && !isStart && !isEnd && "ring-1 ring-inset ring-accent"
                )}
              >
                {cell.day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PRESETS: { label: string; get: () => [string, string] }[] = [
  { label: "Today", get: () => [todayLocalISO(), todayLocalISO()] },
  { label: "Last 7 Days", get: () => [daysAgoLocalISO(6), todayLocalISO()] },
  { label: "Last 30 Days", get: () => [daysAgoLocalISO(29), todayLocalISO()] },
  { label: "This Month", get: () => [firstOfMonthISO(), todayLocalISO()] },
];

export function FilterBar() {
  const {
    tab,
    outlet,
    category,
    categoryDetail,
    dateStart,
    dateEnd,
    setOutlet,
    setCategoryDetail,
    setCategoryAndDetail,
    setDateRange,
  } = useDashboardFilters();
  const [pickerOpen, setPickerOpen] = useState(false);
  // Pending start of an in-progress custom-range selection -- null means "no
  // selection in progress", so the popover shows the committed dateStart/
  // dateEnd (from the URL) instead. Set on the first click of a new range;
  // cleared back to null on open/close/commit.
  const [draftStart, setDraftStart] = useState<string | null>(null);
  // Live cursor position while draftStart is pending -- drives the
  // start-to-cursor preview shadow, purely visual (never applied).
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  // Left/right panels navigate independently (no longer locked to
  // left/left+1), so a range spanning more than 2 months apart can still be
  // picked by browsing each side separately.
  const [leftMonth, setLeftMonth] = useState<YM>(() => {
    const [y, m] = dateStart.split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const [rightMonth, setRightMonth] = useState<YM>(() => addMonths(leftMonth, 1));

  const containerRef = useRef<HTMLDivElement>(null);
  // Mirrors draftStart synchronously (state updates aren't visible to a
  // setTimeout closure scheduled in the same tick) so the click/dblclick
  // disambiguation below always reads the latest value, not a stale one
  // captured when the timeout was scheduled.
  const draftStartRef = useRef<string | null>(null);
  // One shared "pending single click" timer: a click schedules the
  // single-click action after a short delay; a second click on the SAME date
  // (i.e. the browser's own dblclick sequence) cancels it so a real dblclick
  // can take over -- this is what keeps double click from firing the
  // single-click handler at all, let alone the API call twice.
  const pendingClickRef = useRef<{ date: string; timeoutId: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    return () => {
      if (pendingClickRef.current) clearTimeout(pendingClickRef.current.timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closePicker();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closePicker();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  // Category/categoryDetail have no effect on the Overview tab (its KPIs
  // never take a category dimension -- see v_sales_daily_outlet), so the
  // dropdowns are hidden there and their option queries skipped entirely.
  const categoryFilterVisible = tab !== "overview";

  const { data: outlets } = useQuery({ queryKey: ["outlet-options"], queryFn: getOutletOptions });
  const { data: categories } = useQuery({
    queryKey: ["category-options"],
    queryFn: getCategoryOptions,
    enabled: categoryFilterVisible,
  });
  const { data: categoryDetails } = useQuery({
    queryKey: ["category-detail-options"],
    queryFn: getCategoryDetailOptions,
    enabled: categoryFilterVisible,
  });

  // Detail dropdown is scoped to the selected category (category > category
  // detail > menu hierarchy) -- "all categories" shows every detail.
  const categoryDetailOptions =
    category === ALL_CATEGORIES ? categoryDetails : categoryDetails?.filter((c) => c.category_id === category);

  function handleCategoryChange(nextCategory: string) {
    const detailStillInScope =
      categoryDetail === ALL_CATEGORY_DETAILS ||
      nextCategory === ALL_CATEGORIES ||
      categoryDetails?.some((c) => c.category_id === nextCategory && c.category_detail_id === categoryDetail);
    setCategoryAndDetail(nextCategory, detailStillInScope ? categoryDetail : ALL_CATEGORY_DETAILS);
  }

  const today = todayLocalISO();
  const selectClass =
    "px-3.5 py-2.5 rounded-[10px] border border-border-form bg-surface text-[13px] font-medium text-text";

  function updateDraftStart(value: string | null) {
    draftStartRef.current = value;
    setDraftStart(value);
  }

  function openPicker() {
    const [y, m] = dateStart.split("-").map(Number);
    const left = { year: y, month: m - 1 };
    setLeftMonth(left);
    setRightMonth(addMonths(left, 1));
    updateDraftStart(null);
    setHoverDate(null);
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
    updateDraftStart(null);
    setHoverDate(null);
  }

  function togglePicker() {
    if (pickerOpen) closePicker();
    else openPicker();
  }

  /** Existing filter/API flow: one URL update (triggers the existing react-query-driven fetch), then close. */
  function commitRange(a: string, b: string) {
    const start = a <= b ? a : b;
    const end = a <= b ? b : a;
    setDateRange(start, end);
    setPickerOpen(false);
    updateDraftStart(null);
    setHoverDate(null);
  }

  function runSingleClick(iso: string) {
    const pending = draftStartRef.current;
    if (pending == null) {
      updateDraftStart(iso); // first date of a new range -- popover stays open, nothing applied yet
    } else {
      commitRange(pending, iso); // second date completes the range -- apply once, close
    }
  }

  function handleDayClick(iso: string, disabled: boolean) {
    if (disabled) return;
    if (pendingClickRef.current && pendingClickRef.current.date === iso) {
      clearTimeout(pendingClickRef.current.timeoutId);
    }
    const timeoutId = setTimeout(() => {
      if (pendingClickRef.current?.timeoutId === timeoutId) pendingClickRef.current = null;
      runSingleClick(iso);
    }, 250);
    pendingClickRef.current = { date: iso, timeoutId };
  }

  function handleDayDoubleClick(iso: string, disabled: boolean) {
    if (disabled) return;
    if (pendingClickRef.current) {
      clearTimeout(pendingClickRef.current.timeoutId);
      pendingClickRef.current = null;
    }
    commitRange(iso, iso);
  }

  const rangeStart = draftStart ?? dateStart;
  const rangeEnd = draftStart ? null : dateEnd;
  const previewStart = draftStart != null && hoverDate != null ? (draftStart <= hoverDate ? draftStart : hoverDate) : null;
  const previewEnd = draftStart != null && hoverDate != null ? (draftStart <= hoverDate ? hoverDate : draftStart) : null;

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

      <div className="relative" ref={containerRef}>
        <div
          onClick={togglePicker}
          className={cn(
            "flex items-center gap-2.5 px-3.5 py-2.5 bg-surface border rounded-[10px] text-[13px] font-medium cursor-pointer select-none",
            pickerOpen ? "border-accent" : "border-border-form"
          )}
        >
          {fmtDateDMY(dateStart)} &rarr; {fmtDateDMY(dateEnd)}
          <CalendarIcon />
        </div>

        {pickerOpen && (
          <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 bg-surface border border-border-form rounded-xl p-4 shadow-[var(--shadow-popover)] z-20 w-[min(92vw,644px)]">
            <div className="flex flex-col sm:flex-row gap-5" onMouseLeave={() => setHoverDate(null)}>
              <MonthPanel
                ym={leftMonth}
                today={today}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                previewStart={previewStart}
                previewEnd={previewEnd}
                hoverDate={hoverDate}
                onPrev={() => setLeftMonth((m) => addMonths(m, -1))}
                onNext={() => setLeftMonth((m) => addMonths(m, 1))}
                onDayClick={handleDayClick}
                onDayDoubleClick={handleDayDoubleClick}
                onDayHover={setHoverDate}
              />
              <MonthPanel
                ym={rightMonth}
                today={today}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                previewStart={previewStart}
                previewEnd={previewEnd}
                hoverDate={hoverDate}
                onPrev={() => setRightMonth((m) => addMonths(m, -1))}
                onNext={() => setRightMonth((m) => addMonths(m, 1))}
                onDayClick={handleDayClick}
                onDayDoubleClick={handleDayDoubleClick}
                onDayHover={setHoverDate}
              />
            </div>

            <div className="flex flex-wrap gap-2 mt-4 pt-3.5 border-t border-border-subtle">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    const [start, end] = p.get();
                    commitRange(start, end);
                  }}
                  className="px-3 py-1.5 rounded-full bg-accent-soft text-accent text-[12px] font-semibold cursor-pointer hover:bg-accent-soft-strong"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {categoryFilterVisible && (
        <>
          <select value={category} onChange={(e) => handleCategoryChange(e.target.value)} className={selectClass}>
            <option value={ALL_CATEGORIES}>{ALL_CATEGORIES}</option>
            {categories?.map(
              (c) =>
                c.category_id && (
                  <option key={c.category_id} value={c.category_id}>
                    {c.category_name}
                  </option>
                )
            )}
          </select>

          <select value={categoryDetail} onChange={(e) => setCategoryDetail(e.target.value)} className={selectClass}>
            <option value={ALL_CATEGORY_DETAILS}>{ALL_CATEGORY_DETAILS}</option>
            {categoryDetailOptions?.map(
              (c) =>
                c.category_detail_id && (
                  <option key={c.category_detail_id} value={c.category_detail_id}>
                    {c.category_detail_name}
                  </option>
                )
            )}
          </select>
        </>
      )}
    </div>
  );
}
