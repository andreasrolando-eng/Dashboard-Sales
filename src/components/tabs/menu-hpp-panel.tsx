"use client";

import { Fragment, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMenuBomDetail, getMenuHpp } from "@/lib/queries/sales";
import { getIsAdmin } from "@/lib/queries/meta";
import { triggerHppSync } from "@/lib/queries/sync";
import { fmtDateID, fmtRupiah } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ExportButtons } from "@/components/ui/export-buttons";
import type { ExportSpec } from "@/lib/export/types";

type MenuHppRow = Awaited<ReturnType<typeof getMenuHpp>>[number];
type CoverageStatus = MenuHppRow["cost_coverage_status"];

export const COVERAGE_LABEL: Record<CoverageStatus, string> = {
  complete: "Lengkap",
  incomplete_cost: "HPP bahan belum lengkap",
  no_historical_cost: "Belum ada snapshot",
  no_bom: "Tanpa BOM",
  package: "Paket (belum dihitung)",
  unmapped: "Tidak ada di master ESB",
};

const COVERAGE_STYLE: Record<CoverageStatus, { bg: string; color: string }> = {
  complete: { bg: "var(--color-positive-soft)", color: "var(--color-positive)" },
  incomplete_cost: { bg: "oklch(94% 0.06 85)", color: "oklch(48% 0.12 70)" },
  no_historical_cost: { bg: "oklch(94% 0.06 85)", color: "oklch(48% 0.12 70)" },
  no_bom: { bg: "oklch(93% 0.005 260)", color: "oklch(45% 0.01 260)" },
  package: { bg: "oklch(93% 0.005 260)", color: "oklch(45% 0.01 260)" },
  unmapped: { bg: "var(--color-negative-soft)", color: "var(--color-negative)" },
};

type SortKey = "menu_name" | "qty" | "avg_selling_price" | "latest_hpp" | "cogs" | "uncosted_qty";

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: "menu_name", label: "Menu" },
  { key: "qty", label: "Qty" },
  { key: "avg_selling_price", label: "Harga Jual Rata-rata" },
  { key: "latest_hpp", label: "HPP Terkini" },
  { key: "cogs", label: "COGS Historis" },
  { key: "uncosted_qty", label: "Qty Tanpa HPP" },
  { key: null, label: "Status" },
];

const GRID = "grid grid-cols-[24px_2fr_0.7fr_1.1fr_1.1fr_1.2fr_0.9fr_1.3fr] gap-2";

function fmtQty(n: number | null | undefined) {
  return n == null ? "—" : n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function compare(a: MenuHppRow, b: MenuHppRow, key: SortKey) {
  if (key === "menu_name") return (a.menu_name ?? "").localeCompare(b.menu_name ?? "", "id");
  return (a[key] ?? -Infinity) - (b[key] ?? -Infinity);
}

/**
 * HPP & historical COGS per menu. Each day's sales are costed with the BOM
 * snapshot in force on that day (strict as-of), so COGS only covers the qty
 * that could be costed -- the rest is shown separately, never hidden.
 * Food cost % and margin are deliberately not shown until the revenue basis
 * of the sales data is validated.
 */
export function MenuHppPanel({
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
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "cogs", dir: "desc" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);

  const hppQuery = useQuery({
    queryKey: ["menu-hpp", outlet, category, categoryDetail, dateStart, dateEnd],
    queryFn: () => getMenuHpp(dateStart, dateEnd, outlet, category, categoryDetail),
  });
  const adminQuery = useQuery({ queryKey: ["is-admin"], queryFn: getIsAdmin, staleTime: Infinity });

  const rows = [...(hppQuery.data ?? [])].sort((a, b) => {
    const c = compare(a, b, sort.key);
    return sort.dir === "asc" ? c : -c;
  });
  const latestSnapshot = rows.reduce<string | null>(
    (max, r) => (r.latest_snapshot_date && (!max || r.latest_snapshot_date > max) ? r.latest_snapshot_date : max),
    null
  );

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "menu_name" ? "asc" : "desc" }));
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await triggerHppSync();
      if (result.status === "partial_success") {
        setSyncMessage({
          tone: "warn",
          text: `Sebagian berhasil: ${result.boms?.failed ?? 0} dari ${result.boms?.total ?? 0} BOM gagal diambil. HPP menu tersebut tetap memakai snapshot sebelumnya.`,
        });
      } else {
        setSyncMessage({ tone: "ok", text: `HPP diperbarui (${result.menus ?? 0} menu, ${result.boms?.total ?? 0} BOM).` });
      }
      // invoke() only resolves after the function has published, so a refetch now sees the new snapshot.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["menu-hpp"] }),
        queryClient.invalidateQueries({ queryKey: ["menu-bom-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["ingredient-usage"] }),
      ]);
    } catch (err) {
      setSyncMessage({ tone: "error", text: err instanceof Error ? err.message : "Sync HPP gagal" });
    } finally {
      setSyncing(false);
    }
  }

  const exportSpec: ExportSpec<MenuHppRow> = {
    fileBaseName: "hpp-per-menu",
    title: "HPP per Menu",
    subtitle: `${fmtDateID(dateStart)} - ${fmtDateID(dateEnd)} | HPP dihitung per tanggal jual (snapshot BOM yang berlaku)`,
    columns: [
      { header: "Menu", accessor: (r) => r.menu_name, width: 26 },
      { header: "Qty", accessor: (r) => r.qty, format: "number", align: "right", width: 10 },
      { header: "Harga Jual Rata-rata", accessor: (r) => r.avg_selling_price ?? 0, format: "currency", align: "right", width: 16 },
      { header: "HPP Terkini", accessor: (r) => (r.latest_cost_status === "ok" ? r.latest_hpp ?? 0 : null), format: "currency", align: "right", width: 14 },
      { header: "COGS Historis", accessor: (r) => r.cogs, format: "currency", align: "right", width: 16 },
      { header: "Qty Tanpa HPP", accessor: (r) => r.uncosted_qty, format: "number", align: "right", width: 12 },
      { header: "Status", accessor: (r) => COVERAGE_LABEL[r.cost_coverage_status], width: 22 },
    ],
  };

  return (
    <div className="bg-surface border border-border rounded-[14px] p-5 mt-4 overflow-x-auto">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
        <div>
          <div className="text-sm font-bold text-text">HPP &amp; Margin per Menu</div>
          <div className="text-xs text-text-secondary mt-0.5">
            {latestSnapshot ? `Snapshot HPP terakhir: ${fmtDateID(latestSnapshot)}` : "Belum ada snapshot HPP untuk periode ini"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <ExportButtons spec={exportSpec} dateStart={dateStart} dateEnd={dateEnd} rows={rows} disabled={rows.length === 0} />
          {adminQuery.data && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="px-3.5 py-1.5 rounded-lg border-none bg-accent text-white text-xs font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              {syncing ? "Menyinkronkan HPP..." : "Sync HPP"}
            </button>
          )}
        </div>
      </div>

      {syncMessage && (
        <div
          className="text-xs mb-3"
          style={{ color: syncMessage.tone === "error" ? "var(--color-negative)" : syncMessage.tone === "warn" ? "oklch(48% 0.12 70)" : "var(--color-positive)" }}
        >
          {syncMessage.text}
        </div>
      )}

      <div className="text-xs text-text-secondary bg-accent-soft rounded-lg px-3 py-2 mb-3.5">
        Food cost % dan margin belum ditampilkan karena basis revenue (sebelum/sesudah diskon, pajak, service) belum
        tervalidasi. COGS hanya mencakup qty yang punya HPP lengkap pada tanggal jualnya.
      </div>

      {hppQuery.isLoading ? (
        <div className="text-sm text-text-secondary py-4">Memuat data...</div>
      ) : hppQuery.isError ? (
        <div className="text-sm text-negative py-4">Gagal memuat HPP: {(hppQuery.error as Error).message}</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-text-secondary py-4">Tidak ada penjualan menu untuk filter ini.</div>
      ) : (
        <div className="min-w-[880px]">
          <div className={`${GRID} text-[11px] font-semibold text-text-secondary pb-2.5 px-1 border-b border-border-subtle`}>
            <div />
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
          {rows.map((m) => {
            const isOpen = expanded === m.menu_id;
            const style = COVERAGE_STYLE[m.cost_coverage_status];
            return (
              <Fragment key={m.menu_id}>
                <div
                  onClick={() => setExpanded(isOpen ? null : m.menu_id)}
                  className={`${GRID} text-[13px] py-2.5 px-1 border-b border-border-hairline items-center cursor-pointer hover:bg-hover`}
                >
                  <div className="text-text-tertiary text-xs">{isOpen ? "▾" : "▸"}</div>
                  <div className="font-semibold text-text">{m.menu_name ?? m.menu_id}</div>
                  <div>{fmtQty(m.qty)}</div>
                  <div>{m.avg_selling_price != null ? fmtRupiah(m.avg_selling_price) : "—"}</div>
                  <div>
                    {m.latest_hpp == null || m.latest_cost_status === "no_bom" || m.latest_cost_status === "package" ? (
                      "—"
                    ) : m.latest_cost_status === "incomplete_cost" ? (
                      <span title="Sebagian bahan belum punya HPP di ESB; angka ini hanya bahan yang ber-HPP">
                        ≥ {fmtRupiah(m.latest_hpp)}
                      </span>
                    ) : (
                      fmtRupiah(m.latest_hpp)
                    )}
                  </div>
                  <div>
                    {fmtRupiah(m.cogs)}
                    {m.uncosted_qty > 0 && m.costed_qty > 0 && <span className="text-[11px] text-text-tertiary"> (parsial)</span>}
                  </div>
                  <div className={m.uncosted_qty > 0 ? "text-[oklch(48%_0.12_70)] font-semibold" : ""}>{fmtQty(m.uncosted_qty)}</div>
                  <div>
                    <Badge bg={style.bg} color={style.color}>
                      {COVERAGE_LABEL[m.cost_coverage_status]}
                    </Badge>
                  </div>
                </div>
                {isOpen && <BomDetail menuId={m.menu_id} asOf={dateEnd} status={m.latest_cost_status} />}
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Ingredients of one menu from the BOM snapshot in force at the end of the period. Fetched only when expanded. */
function BomDetail({ menuId, asOf, status }: { menuId: string; asOf: string; status: MenuHppRow["latest_cost_status"] }) {
  const query = useQuery({
    queryKey: ["menu-bom-detail", menuId, asOf],
    queryFn: () => getMenuBomDetail(menuId, asOf),
  });
  const lines = query.data ?? [];

  let body: React.ReactNode;
  if (query.isLoading) body = <div className="text-xs text-text-secondary py-2">Memuat bahan...</div>;
  else if (query.isError) body = <div className="text-xs text-negative py-2">Gagal memuat bahan: {(query.error as Error).message}</div>;
  else if (lines.length === 0)
    body = (
      <div className="text-xs text-text-secondary py-2">
        {status === "no_bom"
          ? "Menu ini tidak punya BOM di ESB."
          : status === "package"
            ? "Menu paket — HPP paket belum dihitung."
            : "Belum ada snapshot BOM untuk menu ini pada atau sebelum tanggal akhir periode."}
      </div>
    );
  else
    body = (
      <>
        <div className="text-[11px] text-text-tertiary mb-1.5">
          BOM #{lines[0].bom_id} · snapshot {fmtDateID(lines[0].snapshot_date)}
        </div>
        <div className="grid grid-cols-[2fr_0.8fr_0.6fr_1fr_1fr_1.6fr] gap-2 text-[11px] font-semibold text-text-secondary pb-1.5 border-b border-border-subtle">
          <div>Bahan</div>
          <div>Qty</div>
          <div>UOM</div>
          <div>Last HPP</div>
          <div>Biaya</div>
          <div>Substitusi</div>
        </div>
        {lines.map((l) => (
          <div
            key={l.line_id}
            className="grid grid-cols-[2fr_0.8fr_0.6fr_1fr_1fr_1.6fr] gap-2 text-xs py-1.5 border-b border-border-hairline items-center"
          >
            <div>
              <span className="text-text">{l.product_name ?? "—"}</span>
              {l.product_code && <span className="text-text-tertiary"> · {l.product_code}</span>}
            </div>
            <div>{fmtQty(l.qty)}</div>
            <div>{l.uom_name ?? "—"}</div>
            <div>{l.last_hpp != null && l.last_hpp > 0 ? fmtRupiah(l.last_hpp) : "—"}</div>
            <div>
              {l.is_valid && l.line_cost != null ? (
                fmtRupiah(l.line_cost)
              ) : (
                <Badge bg="oklch(94% 0.06 85)" color="oklch(48% 0.12 70)">
                  HPP bahan kosong
                </Badge>
              )}
            </div>
            <div className="text-text-secondary">
              {l.substitutions.length === 0
                ? "—"
                : l.substitutions
                    .map((s) => s.productNameSubtitution ?? s.productNameDetail)
                    .filter(Boolean)
                    .join(", ")}
            </div>
          </div>
        ))}
      </>
    );

  return <div className="bg-page-bg border-b border-border-hairline px-4 py-3 pl-9">{body}</div>;
}

