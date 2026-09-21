import type { ExportSpec } from "./types";

function formatCell(value: string | number | null, format: ExportSpec<unknown>["columns"][number]["format"]): string {
  if (value === null) return "-";
  if (typeof value === "number") {
    if (format === "currency") return `Rp${Math.round(value).toLocaleString("id-ID")}`;
    if (format === "percent") return `${value.toFixed(1)}%`;
    if (format === "number") return value.toLocaleString("id-ID");
  }
  return String(value);
}

async function fetchLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/ESB-logo.png");
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null; // Missing letterhead isn't worth failing the whole export over.
  }
}

/**
 * Builds a tabular PDF report. Dynamically imports jspdf/jspdf-autotable --
 * see export-buttons.tsx for why. v1 scope: table + header text only, no
 * chart images. jsPDF's built-in fonts only cover Latin glyphs -- a menu/
 * member name with non-Latin characters would render as blank boxes here
 * (Excel export is unaffected), accepted as a known limitation for now.
 */
export async function buildPdfReport<T>(spec: ExportSpec<T>, rows: T[]): Promise<Blob> {
  const [{ default: jsPDF }, { default: autoTable }, logoDataUrl] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    fetchLogoDataUrl(),
  ]);

  const doc = new jsPDF({ orientation: "landscape" });
  let cursorY = 15;

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 14, 10, 10, 10);
  }
  doc.setFontSize(14);
  doc.text(spec.title, logoDataUrl ? 28 : 14, cursorY);
  cursorY += 6;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(spec.subtitle, logoDataUrl ? 28 : 14, cursorY);
  cursorY += 5;
  doc.text(`Diekspor: ${new Date().toLocaleString("id-ID")}`, logoDataUrl ? 28 : 14, cursorY);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: cursorY + 5,
    head: [spec.columns.map((c) => c.header)],
    body: rows.map((row) => spec.columns.map((c) => formatCell(c.accessor(row), c.format))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: Object.fromEntries(
      spec.columns.map((c, i) => [i, { halign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left" }])
    ),
  });

  return doc.output("blob");
}
