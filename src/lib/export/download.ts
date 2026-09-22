/** Triggers a browser download for an already-built file Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** `list-transaksi_2026-09-01_2026-09-21.xlsx` */
export function exportFilename(baseName: string, dateStart: string, dateEnd: string, ext: "xlsx" | "pdf"): string {
  return `${baseName}_${dateStart}_${dateEnd}.${ext}`;
}
