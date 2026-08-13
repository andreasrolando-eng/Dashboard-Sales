/** Thousands-separated integer, id-ID locale. */
export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("id-ID");
}

/** Full, unabbreviated Rupiah amount -- "Rp804.600.000", not "Rp804.6jt". Rounds only to the nearest whole Rupiah (no sub-unit currency exists), never to nearest thousand/million. */
export function fmtRupiah(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

/** "13 Agu 2026" */
export function fmtDateID(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgoISO(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

/** "YYYY-MM-01" for the given date's month, formatted from local date parts (not via toISOString/UTC, which can land on the wrong day near midnight). */
export function firstOfMonthISO(from: Date = new Date()): string {
  const year = from.getFullYear();
  const month = String(from.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}
