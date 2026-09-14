"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMenuPerformance } from "@/lib/queries/sales";
import { fmtNum } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Dropdown } from "@/components/ui/dropdown";

const TREND_COLOR = { naik: "#16a34a", turun: "#dc2626", stagnan: "oklch(50% 0.01 260)" } as const;
const TREND_LABEL = { naik: "↑ Naik", turun: "↓ Turun", stagnan: "→ Stagnan" } as const;

const THRESHOLD_OPTIONS = [10, 25, 50, 100, 250, 500, 1000];
const LIMIT_OPTIONS = [5, 10, 20, 50] as const;
const SHOW_ALL = "all" as const;
type Limit = (typeof LIMIT_OPTIONS)[number] | typeof SHOW_ALL;

/**
 * Deliberately holds its own local state and its own useQuery, separate from
 * SalesTab -- so adjusting the threshold/limit dropdowns (or clicking
 * Terapkan) only re-renders and re-fetches this panel, never the KPI cards
 * or charts above it. Draft values (what the dropdowns show) are decoupled
 * from applied values (what the query actually uses) so nothing refetches
 * until Terapkan is clicked; the outlet/category/date range props still flow
 * through live from the global filter bar, per FR-19.
 */
export function MenuUnderperformingPanel({
  outlet,
  category,
  categoryDetail,
  dateStart,
  dateEnd,
}: {
  outlet: string;
  category: string;
  categoryDetail: string;
  dateStart: string;
  dateEnd: string;
}) {
  const [thresholdDraft, setThresholdDraft] = useState(100);
  const [limitDraft, setLimitDraft] = useState<Limit>(10);
  const [applied, setApplied] = useState<{ threshold: number; limit: Limit }>({ threshold: 100, limit: 10 });

  const menuPerfQuery = useQuery({
    queryKey: ["menu-performance", outlet, category, categoryDetail, dateStart, dateEnd, applied.threshold],
    queryFn: () => getMenuPerformance(dateStart, dateEnd, outlet, category, categoryDetail, applied.threshold),
  });

  const rows = !menuPerfQuery.data
    ? []
    : applied.limit === SHOW_ALL
      ? menuPerfQuery.data
      : menuPerfQuery.data.slice(0, applied.limit);

  const isDirty = thresholdDraft !== applied.threshold || limitDraft !== applied.limit;

  function handleApply() {
    setApplied({ threshold: thresholdDraft, limit: limitDraft });
  }

  const selectClass = "px-2 py-1 rounded-md border border-border-form text-xs font-sans bg-surface text-text";

  return (
    <div className="bg-surface border border-border rounded-[14px] p-5 mt-4 overflow-x-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3.5">
        <div className="text-sm font-bold text-text">Analisa Menu Underperforming</div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            Threshold takeout:
            <Dropdown
              value={String(thresholdDraft)}
              onChange={(v) => setThresholdDraft(Number(v))}
              className={selectClass}
              options={THRESHOLD_OPTIONS.map((t) => ({ value: String(t), label: `<${t} unit` }))}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            Tampilkan:
            <Dropdown
              value={String(limitDraft)}
              onChange={(v) => setLimitDraft(v === SHOW_ALL ? SHOW_ALL : (Number(v) as Limit))}
              className={selectClass}
              options={[
                ...LIMIT_OPTIONS.map((n) => ({ value: String(n), label: `${n} menu` })),
                { value: SHOW_ALL, label: "Semua" },
              ]}
            />
          </label>
          <button
            type="button"
            onClick={handleApply}
            disabled={!isDirty}
            className="px-3.5 py-1.5 rounded-lg border-none bg-accent text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            Terapkan
          </button>
        </div>
      </div>

      {menuPerfQuery.isLoading ? (
        <div className="text-sm text-text-secondary py-4">Memuat data...</div>
      ) : (
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] text-[11px] font-semibold text-text-secondary pb-2.5 px-1 border-b border-border-subtle">
            <div>Menu</div>
            <div>Unit Terjual</div>
            <div>Kontribusi Revenue</div>
            <div>Tren</div>
            <div>Status</div>
          </div>
          {rows.map((m) => (
            <div
              key={m.menu_id}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] text-[13px] py-2.5 px-1 border-b border-border-hairline items-center"
            >
              <div className="font-semibold text-text">{m.menu_name}</div>
              <div>{fmtNum(m.qty)}</div>
              <div>{m.contribution_pct ?? 0}%</div>
              <div className="font-semibold" style={{ color: TREND_COLOR[m.trend] }}>
                {TREND_LABEL[m.trend]}
              </div>
              <div>
                {m.is_takeout_candidate ? (
                  <Badge bg="oklch(93% 0.04 25)" color="#dc2626">
                    Kandidat Takeout
                  </Badge>
                ) : (
                  <Badge bg="oklch(93% 0.005 260)" color="oklch(45% 0.01 260)">
                    Pantau
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
