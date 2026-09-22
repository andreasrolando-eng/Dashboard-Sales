"use client";

import { useState } from "react";
import type { ExportSpec } from "@/lib/export/types";
import { buildExcelWorkbook } from "@/lib/export/excel";
import { buildPdfReport } from "@/lib/export/pdf";
import { downloadBlob, exportFilename } from "@/lib/export/download";

type Format = "excel" | "pdf";
type Status = "idle" | "loading" | "generating" | "error";

type ExportButtonsProps<T> = {
  spec: ExportSpec<T>;
  dateStart: string;
  dateEnd: string;
  /** Disables both buttons regardless of status -- e.g. zero rows, or (Sales Bill List) over the row cap. */
  disabled?: boolean;
  disabledReason?: string;
} & (
  | { rows: T[]; loadRows?: undefined }
  | { rows?: undefined; loadRows: (onProgress: (fetched: number, total: number) => void) => Promise<T[]> }
);

/**
 * Two export buttons (Excel/PDF) shared by every exportable panel. Takes
 * either `rows` (data already fully in memory -- every panel except the
 * Sales Bill List) or `loadRows` (a chunked fetch that reports progress --
 * Sales Bill List only, since it's the one server-paginated query).
 */
export function ExportButtons<T>(props: ExportButtonsProps<T>) {
  const { spec, dateStart, dateEnd, disabled, disabledReason } = props;
  const [status, setStatus] = useState<Status>("idle");
  const [activeFormat, setActiveFormat] = useState<Format | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleExport(format: Format) {
    setErrorMessage(null);
    setActiveFormat(format);
    try {
      let rows: T[];
      if (props.rows) {
        rows = props.rows;
      } else {
        setStatus("loading");
        rows = await props.loadRows((fetched, total) => {
          setProgressLabel(`Menyiapkan file... ${fetched}/${total} baris`);
        });
      }

      setProgressLabel(null);
      setStatus("generating");
      const blob = format === "excel" ? await buildExcelWorkbook(spec, rows) : await buildPdfReport(spec, rows);
      downloadBlob(blob, exportFilename(spec.fileBaseName, dateStart, dateEnd, format === "excel" ? "xlsx" : "pdf"));
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Gagal membuat file.");
    } finally {
      setActiveFormat(null);
    }
  }

  const busy = status === "loading" || status === "generating";
  const isDisabled = disabled || busy;

  function label(format: Format, idleLabel: string) {
    if (activeFormat !== format) return idleLabel;
    if (status === "loading" && progressLabel) return progressLabel;
    if (status === "generating") return "Membuat file...";
    return idleLabel;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleExport("excel")}
          disabled={isDisabled}
          className="px-3.5 py-1.5 rounded-lg border-none bg-accent text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
        >
          {label("excel", "Excel")}
        </button>
        <button
          type="button"
          onClick={() => handleExport("pdf")}
          disabled={isDisabled}
          className="px-3.5 py-1.5 rounded-lg border border-border-form bg-surface text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {label("pdf", "PDF")}
        </button>
      </div>
      {disabled && disabledReason && <div className="text-xs text-text-tertiary">{disabledReason}</div>}
      {status === "error" && errorMessage && <div className="text-xs text-[#dc2626]">{errorMessage}</div>}
    </div>
  );
}
