"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMemberMenuPurchases, getMemberOptions } from "@/lib/queries/membership";
import { fmtDateID, fmtNum, fmtRupiah } from "@/lib/format";

/**
 * Per-member menu purchase report ("member ini beli menu apa aja") for the
 * Membership tab -- own query, own local state (selected member), same
 * pattern as SalesBillListPanel so picking a member only re-renders this
 * panel, never the KPI cards/tables above it. Caller remounts this via a
 * `key` derived from outlet/dateStart/dateEnd, same reason as that panel:
 * snaps the selection back to a valid default whenever the filter scope
 * changes the member list.
 */
export function MemberMenuReportPanel({
  outlet,
  dateStart,
  dateEnd,
}: {
  outlet: string;
  dateStart: string;
  dateEnd: string;
}) {
  const [selectedMember, setSelectedMember] = useState("");

  const optionsQuery = useQuery({
    queryKey: ["member-options", outlet],
    queryFn: () => getMemberOptions(outlet),
  });
  const activeMember = selectedMember || optionsQuery.data?.[0]?.member_code || "";

  const purchasesQuery = useQuery({
    queryKey: ["member-menu-purchases", activeMember, outlet, dateStart, dateEnd],
    queryFn: () => getMemberMenuPurchases(activeMember, dateStart, dateEnd, outlet),
    enabled: !!activeMember,
  });

  const selectClass = "px-2 py-1 rounded-md border border-border-form text-xs font-sans bg-surface text-text";

  if (optionsQuery.isError || purchasesQuery.isError) {
    const err = optionsQuery.error ?? purchasesQuery.error;
    return (
      <div className="bg-surface border border-border rounded-[14px] p-5 mt-4">
        <div className="text-sm font-bold text-text mb-3">Riwayat Menu per Member</div>
        <div className="text-sm text-[#dc2626]">
          Gagal memuat data: {err instanceof Error ? err.message : "Terjadi kesalahan tak terduga"}
        </div>
      </div>
    );
  }

  if (!optionsQuery.data) {
    return (
      <div className="bg-surface border border-border rounded-[14px] p-5 mt-4">
        <div className="text-sm font-bold text-text mb-3">Riwayat Menu per Member</div>
        <div className="text-sm text-text-secondary">Memuat data...</div>
      </div>
    );
  }

  const options = optionsQuery.data;
  const rows = purchasesQuery.data ?? [];
  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);

  return (
    <div className="bg-surface border border-border rounded-[14px] p-5 mt-4 overflow-x-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3.5">
        <div className="text-sm font-bold text-text">Riwayat Menu per Member</div>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          Member:
          <select
            value={activeMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            className={selectClass}
            disabled={options.length === 0}
          >
            {options.length === 0 && <option value="">Tidak ada member</option>}
            {options.map((m) => (
              <option key={m.member_code} value={m.member_code}>
                {m.member_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {purchasesQuery.isLoading ? (
        <div className="text-sm text-text-secondary py-4">Memuat data...</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-text-secondary py-4">Tidak ada pembelian menu pada periode ini.</div>
      ) : (
        <>
          <div className="min-w-[480px]">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[11px] font-semibold text-text-secondary pb-2.5 px-1 border-b border-border-subtle">
              <div>Menu</div>
              <div>Qty</div>
              <div>Total Belanja</div>
              <div>Terakhir Dibeli</div>
            </div>
            {rows.map((r) => (
              <div
                key={r.menu_id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[13px] py-[11px] px-1 border-b border-border-hairline items-center"
              >
                <div className="font-semibold text-text">{r.menu_name}</div>
                <div>{fmtNum(r.qty)}</div>
                <div className="font-bold text-text">{fmtRupiah(r.revenue)}</div>
                <div className="text-text-secondary">{r.last_purchase_date ? fmtDateID(r.last_purchase_date) : "-"}</div>
              </div>
            ))}
          </div>

          <div className="text-xs text-text-secondary mt-3.5 pt-3.5 border-t border-border-subtle">
            {fmtNum(rows.length)} menu berbeda · {fmtNum(totalQty)} item · {fmtRupiah(totalRevenue)}
          </div>
        </>
      )}
    </div>
  );
}
