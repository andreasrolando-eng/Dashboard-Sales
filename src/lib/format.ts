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

/** "13 Agu" -- no year, for narrow chart axis ticks. */
export function fmtDateShortID(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

const DAY_NAMES_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAY_NAMES_FULL_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "Kam" -- short Indonesian day-of-week name. */
export function fmtDayShortID(iso: string): string {
  return DAY_NAMES_ID[new Date(iso).getDay()];
}

/** "Kamis, 13 Agustus 2026" -- full weekday + full date, for chart tooltips. */
export function fmtDateFullID(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return `${DAY_NAMES_FULL_ID[d.getDay()]}, ${date}`;
}

/** Sabtu/Minggu. */
export function isWeekendISO(iso: string): boolean {
  const day = new Date(iso).getDay();
  return day === 0 || day === 6;
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgoISO(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

/** "2026-08-21" from local Y/M/D fields -- unlike toISODate(), never round-trips through toISOString()/UTC, so it can't shift the calendar day for positive/negative-offset timezones (e.g. WIB) near midnight. */
function localISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Timezone-safe "today", for date-only (not datetime) filtering -- see localISODate. */
export function todayLocalISO(): string {
  return localISODate(new Date());
}

/** Timezone-safe "n days ago inclusive of today" -- see localISODate. */
export function daysAgoLocalISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localISODate(d);
}

/** "04-08-2026" -- DD-MM-YYYY, parsed straight from the "YYYY-MM-DD" string (no Date() round-trip), so the day can't shift under a UTC/local mismatch. */
export function fmtDateDMY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

/** "YYYY-MM-01" for the given date's month, formatted from local date parts (not via toISOString/UTC, which can land on the wrong day near midnight). */
export function firstOfMonthISO(from: Date = new Date()): string {
  const year = from.getFullYear();
  const month = String(from.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}
