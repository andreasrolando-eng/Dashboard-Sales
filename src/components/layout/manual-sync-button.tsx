"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { triggerManualSync } from "@/lib/queries/sync";
import { isMockMode } from "@/lib/mock/is-mock";
import { daysAgoISO, toISODate } from "@/lib/format";

type Status = "idle" | "syncing" | "success" | "error";

export function ManualSyncButton() {
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState(() => daysAgoISO(1));
  const [dateTo, setDateTo] = useState(() => daysAgoISO(1));
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [failedDays, setFailedDays] = useState<{ date: string; error?: string }[]>([]);

  // No live Supabase project to sync against in dev fixture mode.
  if (isMockMode()) return null;

  const today = toISODate(new Date());

  async function handleSync() {
    setStatus("syncing");
    setMessage(null);
    setFailedDays([]);
    try {
      const result = await triggerManualSync(dateFrom, dateTo);
      const failed = result.days.filter((d) => !d.ok);
      const totalRows = result.days.reduce(
        (sum, d) => sum + (d.ok ? (d.outlets ?? 0) + (d.sales ?? 0) + (d.payments ?? 0) + (d.menuItems ?? 0) : 0),
        0
      );
      setStatus(result.ok ? "success" : "error");
      setMessage(
        failed.length > 0
          ? `${totalRows} baris ke-sync, ${failed.length}/${result.days.length} hari gagal`
          : `Sukses: ${totalRows} baris disinkronkan (${result.days.length} hari)`
      );
      setFailedDays(failed.map((d) => ({ date: d.date, error: d.error })));
      queryClient.invalidateQueries();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Sync gagal");
    }
  }

  /** Loads a single failed date back into the range inputs so "Sync Manual" retries just that day. */
  function retryDate(date: string) {
    setDateFrom(date);
    setDateTo(date);
    setFailedDays([]);
    setMessage(null);
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          type="date"
          value={dateFrom}
          max={dateTo}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-border-form text-xs font-sans"
        />
        <span className="text-xs text-text-tertiary">–</span>
        <input
          type="date"
          value={dateTo}
          min={dateFrom}
          max={today}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-border-form text-xs font-sans"
        />
        <button
          type="button"
          onClick={handleSync}
          disabled={status === "syncing"}
          className="px-3.5 py-1.5 rounded-lg border-none bg-accent text-white text-xs font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap"
        >
          {status === "syncing" ? "Menyinkronkan..." : "Sync Manual"}
        </button>
      </div>
      {message && (
        <div className="text-xs text-right max-w-[280px]" style={{ color: status === "error" ? "#dc2626" : "#16a34a" }}>
          {message}
        </div>
      )}
      {failedDays.length > 0 && (
        <div className="flex flex-col items-end gap-1 max-w-[320px]">
          {failedDays.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => retryDate(d.date)}
              title={d.error ?? "Klik untuk isi ulang tanggal ini, lalu klik Sync Manual"}
              className="text-xs px-2 py-0.5 rounded-md border-none cursor-pointer whitespace-nowrap"
              style={{ background: "oklch(93% 0.04 25)", color: "#dc2626" }}
            >
              {d.date} — coba lagi
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
