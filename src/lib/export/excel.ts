import type { ExportSpec } from "./types";

function numFmt(format: ExportSpec<unknown>["columns"][number]["format"]): string | undefined {
  switch (format) {
    case "currency":
      return '"Rp"#,##0';
    case "number":
      return "#,##0";
    // Values are already on a 0-100 scale (e.g. 12.5 meaning "12.5%"), so this
    // appends a literal "%" rather than using Excel's native percent numFmt,
    // which would multiply the stored value by 100 again on display.
    case "percent":
      return '0.0"%"';
    default:
      return undefined;
  }
}

/** Builds an .xlsx file in memory. Dynamically imports exceljs -- see export-buttons.tsx for why. */
export async function buildExcelWorkbook<T>(spec: ExportSpec<T>, rows: T[]): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(spec.title.slice(0, 31)); // Excel sheet-name length cap

  sheet.getCell("A1").value = spec.title;
  sheet.getCell("A1").font = { bold: true, size: 13 };
  sheet.getCell("A2").value = spec.subtitle;
  sheet.getCell("A3").value = `Diekspor: ${new Date().toLocaleString("id-ID")}`;
  sheet.getCell("A3").font = { italic: true, size: 9, color: { argb: "FF888888" } };

  const headerRowIndex = 5;
  const headerRow = sheet.getRow(headerRowIndex);
  spec.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { horizontal: col.align ?? "left" };
    const column = sheet.getColumn(i + 1);
    if (col.width) column.width = col.width;
    column.numFmt = numFmt(col.format);
    column.alignment = { horizontal: col.align ?? "left" };
  });

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(headerRowIndex + 1 + rowIndex);
    spec.columns.forEach((col, colIndex) => {
      excelRow.getCell(colIndex + 1).value = col.accessor(row);
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
