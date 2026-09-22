"use client";

import { useState } from "react";
import { useDashboardFilters } from "@/lib/use-dashboard-filters";
import { buildFullReportSections } from "@/lib/export/full-report-data";
import { buildFullReportPdf } from "@/lib/export/pdf";
import { downloadBlob } from "@/lib/export/download";
import { fmtDateID } from "@/lib/format";

type Status = "idle" | "loading" | "generating" | "error";

/**
 * Single global "Laporan Lengkap" button, scoped to whatever date range/
 * outlet filter is currently active on the dashboard -- for sending a
 * complete PDF snapshot of every tab (matching what's on screen) to a
 * principal. Mirrors export-buttons.tsx's status machine; PDF-only, no
 * Excel counterpart. Reads the filter itself via useDashboardFilters()
 * rather than through props, same as Header already does for `tab`.
 */
export function FullReportExportButton() {
  const { outlet, dateStart, dateEnd } = useDashboardFilters();
  const [status, setStatus] = useState<Status>("idle");
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleExport() {
    setErrorMessage(null);
    setStatus("loading");
    try {
      const { sections, outletLabel } = await buildFullReportSections({ dateStart, dateEnd, outlet }, (label) =>
        setProgressLabel(label)
      );

      setProgressLabel(null);
      setStatus("generating");
      const blob = await buildFullReportPdf({
        title: "Laporan Lengkap Dashboard Sales",
        subtitle: `${fmtDateID(dateStart)} - ${fmtDateID(dateEnd)} | ${outletLabel}`,
        sections,
      });
      downloadBlob(blob, `laporan-lengkap-dashboard_${dateStart}_${dateEnd}.pdf`);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Gagal membuat laporan.");
    }
  }

  const busy = status === "loading" || status === "generating";

  function label() {
    if (status === "loading" && progressLabel) return progressLabel;
    if (status === "generating") return "Membuat PDF...";
    return "Export Laporan Lengkap (PDF)";
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="px-3.5 py-1.5 rounded-lg border border-border-form bg-surface text-xs font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {label()}
      </button>
      {status === "error" && errorMessage && <div className="text-xs text-[#dc2626]">{errorMessage}</div>}
    </div>
  );
}
