"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllSalesBillsForExport, getSalesBills, type SalesBill } from "@/lib/queries/sales";
import { getOutletOptions } from "@/lib/queries/meta";
import { ALL_OUTLETS } from "@/lib/use-dashboard-filters";
import { fmtDateID, fmtNum, fmtRupiah } from "@/lib/format";
import { Dropdown } from "@/components/ui/dropdown";
import { ExportButtons } from "@/components/ui/export-buttons";
import type { ExportSpec } from "@/lib/export/types";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

// A browser building an Excel/PDF file in memory for more than this many
// rows risks hanging the tab -- ask the user to narrow the filter instead.
const MAX_EXPORT_ROWS = 50_000;

/**
 * Bill-level drill-down under Menu Underperforming, same "own query, own
 * local state" pattern as that panel -- paging controls only re-render this
 * panel, never the KPI cards/charts above it. Unlike everything else in
 * SalesTab, this is genuinely server-paginated (not a top-N truncation):
 * a month across "Semua Outlet" can run into the thousands of bills.
 *
 * The caller remounts this component (via a `key` derived from
 * outlet/dateStart/dateEnd) whenever the filter scope changes -- simplest
 * way to snap `page` back to 1 for a scope where it may no longer be valid,
 * without a setState-in-effect render cascade.
 */
export function SalesBillListPanel({
  outlet,
  dateStart,
  dateEnd,
}: {
  outlet: string;
  dateStart: string;
  dateEnd: string;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const billsQuery = useQuery({
    queryKey: ["sales-bills", outlet, dateStart, dateEnd, page, pageSize],
    queryFn: () => getSalesBills(dateStart, dateEnd, outlet, page, pageSize),
  });
  const outletOptionsQuery = useQuery({ queryKey: ["outlet-options"], queryFn: getOutletOptions });

  const selectClass = "px-2 py-1 rounded-md border border-border-form text-xs font-sans bg-surface text-text";

  if (billsQuery.isError) {
    return (
      <div className="bg-surface border border-border rounded-[14px] p-5 mt-4">
        <div className="text-sm font-bold text-text mb-3">List Transaksi</div>
        <div className="text-sm text-[#dc2626]">
          Gagal memuat data: {billsQuery.error instanceof Error ? billsQuery.error.message : "Terjadi kesalahan tak terduga"}
        </div>
      </div>
    );
  }

  if (!billsQuery.data || !outletOptionsQuery.data) {
    return (
      <div className="bg-surface border border-border rounded-[14px] p-5 mt-4">
        <div className="text-sm font-bold text-text mb-3">List Transaksi</div>
        <div className="text-sm text-text-secondary">Memuat data...</div>
      </div>
    );
  }

  const { rows, totalCount } = billsQuery.data;
  const outletName = (branchCode: string) =>
    outletOptionsQuery.data.find((o) => o.branch_code === branchCode)?.branch_name ?? branchCode;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const exportSpec: ExportSpec<SalesBill> = {
    fileBaseName: "list-transaksi",
    title: "List Transaksi",
    subtitle: `${fmtDateID(dateStart)} - ${fmtDateID(dateEnd)} | Outlet: ${outlet === ALL_OUTLETS ? ALL_OUTLETS : outletName(outlet)}`,
    columns: [
      { header: "Bill Number", accessor: (r) => r.bill_num },
      { header: "Tanggal", accessor: (r) => r.sales_date, width: 14 },
      { header: "Outlet", accessor: (r) => outletName(r.branch_code), width: 22 },
      { header: "Total", accessor: (r) => r.grand_total, format: "currency", align: "right", width: 16 },
    ],
  };
  const exportDisabled = totalCount === 0 || totalCount > MAX_EXPORT_ROWS;
  const exportDisabledReason =
    totalCount > MAX_EXPORT_ROWS
      ? `Terlalu banyak baris (${fmtNum(totalCount)}) -- sempitkan tanggal/outlet dulu.`
      : undefined;

  return (
    <div className="bg-surface border border-border rounded-[14px] p-5 mt-4 overflow-x-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3.5">
        <div className="text-sm font-bold text-text">List Transaksi</div>
        <div className="flex flex-wrap items-center gap-2.5">
          <ExportButtons
            spec={exportSpec}
            dateStart={dateStart}
            dateEnd={dateEnd}
            disabled={exportDisabled}
            disabledReason={exportDisabledReason}
            loadRows={(onProgress) => getAllSalesBillsForExport(dateStart, dateEnd, outlet, onProgress)}
          />
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            Per halaman:
            <Dropdown
              value={String(pageSize)}
              onChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
              className={selectClass}
              options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
            />
          </label>
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="text-sm text-text-secondary py-4">Tidak ada transaksi pada periode ini.</div>
      ) : (
        <>
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[56px_2fr_1fr_1fr_1fr] text-[11px] font-semibold text-text-secondary pb-2.5 px-1 border-b border-border-subtle">
              <div>No</div>
              <div>Bill Number</div>
              <div>Tanggal</div>
              <div>Outlet</div>
              <div>Total</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.bill_num}
                className="grid grid-cols-[56px_2fr_1fr_1fr_1fr] text-[13px] py-2.5 px-1 border-b border-border-hairline items-center"
              >
                <div className="text-text-tertiary">{(page - 1) * pageSize + i + 1}</div>
                <div className="font-semibold text-text">{r.bill_num}</div>
                <div>{fmtDateID(r.sales_date)}</div>
                <div>{outletName(r.branch_code)}</div>
                <div className="font-semibold text-text">{fmtRupiah(r.grand_total)}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-between items-center gap-3 mt-3.5 pt-3.5 border-t border-border-subtle">
            <div className="text-xs text-text-secondary">
              Halaman {page} dari {totalPages} ({fmtNum(totalCount)} transaksi)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-border-form bg-surface text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-border-form bg-surface text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
