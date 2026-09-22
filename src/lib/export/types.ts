export interface ExportColumn<T> {
  header: string;
  /** Excel column width (character units). Ignored by the PDF exporter. */
  width?: number;
  align?: "left" | "right" | "center";
  format?: "text" | "number" | "currency" | "percent" | "date";
  accessor: (row: T) => string | number | null;
}

export interface ExportSpec<T> {
  /** ASCII/kebab-case -- goes straight into the downloaded filename. */
  fileBaseName: string;
  title: string;
  /** Filter/date-range description shown under the title in both formats. */
  subtitle: string;
  columns: ExportColumn<T>[];
}
