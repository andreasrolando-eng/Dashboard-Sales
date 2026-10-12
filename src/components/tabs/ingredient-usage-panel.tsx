"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getIngredientUsage } from "@/lib/queries/sales";
import { fmtDateID, fmtRupiah } from "@/lib/format";
import { ExportButtons } from "@/components/ui/export-buttons";
import type { ExportSpec } from "@/lib/export/types";

type UsageRow = Awaited<ReturnType<typeof getIngredientUsage>>["rows"][number];
type SortKey = "product_name" | "total_usage_qty" | "menu_count" | "est_cost" | "uncosted_usage_qty";

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: "product_name", label: "Bahan" },
  { key: "total_usage_qty", label: "Total Pemakaian" },
  { key: null, label: "UOM" },
  { key: "menu_count", label: "Dipakai di" },
  { key: "est_cost", label: "Estimasi Biaya" },
  { key: "uncosted_usage_qty", label: "Pemakaian Tanpa HPP" },
];

const GRID = "grid grid-cols-[2.2fr_1.1fr_0.6fr_0.8fr_1.1fr_1.1fr] gap-2";

function fmtQty(n: number) {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function compare(a: UsageRow, b: UsageRow, key: SortKey) {
  if (key === "product_name") return (a.product_name ?? "").localeCompare(b.product_name ?? "", "id");
  return a[key] - b[key];
}

/**
 * Theoretical raw-material usage = qty sold x BOM qty, using the BOM in force
 * on each sales day. Grouped per (ingredient, UOM): the ESB API gives no base
 * unit to safely convert across UOMs. This is what the recipes say was used,
 * not actual stock movement.
 */
export function IngredientUsagePanel({
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
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "total_usage_qty", dir: "desc" });
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["ingredient-usage", outlet, category, categoryDetail, dateStart, dateEnd],
    queryFn: () => getIngredientUsage(dateStart, dateEnd, outlet, category, categoryDetail),
  });

  const needle = search.trim().toLowerCase();
  const rows = (query.data?.rows ?? [])
    .filter((r) => !needle || `${r.product_name ?? ""} ${r.product_code ?? ""}`.toLowerCase().includes(needle))
    .sort((a, b) => {
      const c = compare(a, b, sort.key);
      return sort.dir === "asc" ? c : -c;
    });
  const coverage = query.data?.coverage;

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "product_name" ? "asc" : "desc" }));
  }

  const exportSpec: ExportSpec<UsageRow> = {
    fileBaseName: "pemakaian-bahan-baku",
    title: "Pemakaian Bahan Baku (Teoritis)",
    subtitle: `${fmtDateID(dateStart)} - ${fmtDateID(dateEnd)} | Qty terjual x qty bahan di BOM yang berlaku per tanggal jual`,
    columns: [
      { header: "Bahan", accessor: (r) => r.product_name, width: 28 },
      { header: "Kode", accessor: (r) => r.product_code, width: 14 },
      { header: "Total Pemakaian", accessor: (r) => r.total_usage_qty, format: "number", align: "right", width: 14 },
      { header: "UOM", accessor: (r) => r.uom_name, width: 8 },
      { header: "Dipakai di (menu)", accessor: (r) => r.menu_count, format: "number", align: "right", width: 12 },
      { header: "Estimasi Biaya", accessor: (r) => r.est_cost, format: "currency", align: "right", width: 16 },
      { header: "Pemakaian Tanpa HPP", accessor: (r) => r.uncosted_usage_qty, format: "number", align: "right", width: 16 },
    ],
  };

  return (
    <div className="bg-surface border border-border rounded-[14px] p-5 mt-4 overflow-x-auto">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
        <div>
          <div className="text-sm font-bold text-text">Pemakaian Bahan Baku</div>
          <div className="text-xs text-text-secondary mt-0.5">Teoritis berdasarkan BOM, bukan pergerakan stok aktual</div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari bahan..."
            className="px-2.5 py-1.5 rounded-lg border border-border-form text-xs font-sans bg-surface text-text w-[160px]"
          />
          <ExportButtons spec={exportSpec} dateStart={dateStart} dateEnd={dateEnd} rows={rows} disabled={rows.length === 0} />
        </div>
      </div>

      {coverage && coverage.menu_qty_not_counted > 0 && (
        <div className="text-xs text-[oklch(48%_0.12_70)] bg-[oklch(96%_0.04_85)] rounded-lg px-3 py-2 mb-3.5">
          {fmtQty(coverage.menu_qty_not_counted)} dari {fmtQty(coverage.menu_qty_total)} porsi menu terjual tidak ikut dihitung
          (menu tanpa BOM, paket, belum ada snapshot BOM pada tanggal jual, atau tidak ada di master menu ESB).
        </div>
      )}

      {query.isLoading ? (
        <div className="text-sm text-text-secondary py-4">Memuat data...</div>
      ) : query.isError ? (
        <div className="text-sm text-negative py-4">Gagal memuat pemakaian bahan: {(query.error as Error).message}</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-text-secondary py-4">
          {needle ? "Tidak ada bahan yang cocok dengan pencarian." : "Belum ada data pemakaian bahan untuk filter ini."}
        </div>
      ) : (
        <div className="min-w-[720px]">
          <div className={`${GRID} text-[11px] font-semibold text-text-secondary pb-2.5 px-1 border-b border-border-subtle`}>
            {COLUMNS.map((c) =>
              c.key ? (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => toggleSort(c.key!)}
                  className="text-left bg-transparent border-none p-0 cursor-pointer font-semibold text-text-secondary hover:text-text"
                >
                  {c.label}
                  {sort.key === c.key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                </button>
              ) : (
                <div key={c.label}>{c.label}</div>
              )
            )}
          </div>
          {rows.map((r) => (
            <div
              key={`${r.product_id}|${r.uom_name}`}
              className={`${GRID} text-[13px] py-2.5 px-1 border-b border-border-hairline items-center`}
            >
              <div>
                <span className="font-semibold text-text">{r.product_name ?? "—"}</span>
                {r.product_code && <span className="text-xs text-text-tertiary"> · {r.product_code}</span>}
              </div>
              <div>{fmtQty(r.total_usage_qty)}</div>
              <div>{r.uom_name ?? "—"}</div>
              <div>{r.menu_count} menu</div>
              <div>{fmtRupiah(r.est_cost)}</div>
              <div className={r.uncosted_usage_qty > 0 ? "text-[oklch(48%_0.12_70)] font-semibold" : ""}>
                {r.uncosted_usage_qty > 0 ? fmtQty(r.uncosted_usage_qty) : "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
