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

export interface ReportKpi {
  label: string;
  value: string;
}

export interface ReportTable<T> {
  title: string;
  columns: ExportSpec<T>["columns"];
  rows: T[];
}

export interface ReportSection {
  heading: string;
  kpis: ReportKpi[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sections mix unrelated row shapes (product rows, promo rows, outlet rows, ...) in one array.
  tables: ReportTable<any>[];
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

/**
 * Builds one combined PDF spanning every ReportSection (one page per
 * section) -- KPI grid, then each table -- for the "Laporan Lengkap" button
 * in the Header. Shares the letterhead/formatCell helpers above; same v1
 * scope and Latin-only font limitation as buildPdfReport.
 */
export async function buildFullReportPdf(opts: { title: string; subtitle: string; sections: ReportSection[] }): Promise<Blob> {
  const [{ default: jsPDF }, { default: autoTable }, logoDataUrl] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    fetchLogoDataUrl(),
  ]);

  const doc = new jsPDF({ orientation: "landscape" });

  function drawLetterhead(title: string, subtitle: string): number {
    let cursorY = 15;
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", 14, 10, 10, 10);
    }
    doc.setFontSize(14);
    doc.text(title, logoDataUrl ? 28 : 14, cursorY);
    cursorY += 6;
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(subtitle, logoDataUrl ? 28 : 14, cursorY);
    cursorY += 5;
    doc.text(`Diekspor: ${new Date().toLocaleString("id-ID")}`, logoDataUrl ? 28 : 14, cursorY);
    doc.setTextColor(0);
    return cursorY + 5;
  }

  const cursorY = drawLetterhead(opts.title, opts.subtitle);

  opts.sections.forEach((section, index) => {
    if (index > 0) doc.addPage();

    let y = index === 0 ? cursorY : 15;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(section.heading, 14, y);
    y += 6;

    if (section.kpis.length > 0) {
      autoTable(doc, {
        startY: y,
        body: section.kpis.map((k) => [k.label, k.value]),
        theme: "plain",
        styles: { fontSize: 9, cellPadding: { top: 1, bottom: 1, left: 0, right: 4 } },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 }, 1: {} },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments jsPDF's instance type, not exported from the module.
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    for (const table of section.tables) {
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(table.title, 14, y);
      doc.setTextColor(0);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [table.columns.map((c) => c.header)],
        body: table.rows.map((row) => table.columns.map((c) => formatCell(c.accessor(row), c.format))),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
        columnStyles: Object.fromEntries(
          table.columns.map((c, i) => [i, { halign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left" }])
        ),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments jsPDF's instance type, not exported from the module.
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  });

  return doc.output("blob");
}
