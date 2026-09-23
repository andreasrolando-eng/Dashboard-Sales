import * as z from "zod/v4";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

/** Rejects malformed strings AND impossible calendar dates (e.g. "2026-02-30") by reconstructing the date and checking it round-trips -- a bare regex would let that through since JS's Date rolls invalid days over into the next month. */
export const dateString = z.string().refine(
  (val) => {
    if (!DATE_RE.test(val)) return false;
    const [y, m, d] = val.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  },
  { message: "Must be a valid calendar date in YYYY-MM-DD format" }
);

function daysBetween(dateStart: string, dateEnd: string): number {
  const start = Date.UTC(...(dateStart.split("-").map(Number) as [number, number, number]));
  const end = Date.UTC(...(dateEnd.split("-").map(Number) as [number, number, number]));
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Shared dateStart/dateEnd pair every analytical tool takes -- enforces dateStart<=dateEnd and a max 366-day span so no tool can be made to scan unbounded history. */
export const dateRange = z
  .object({ dateStart: dateString, dateEnd: dateString })
  .refine((v) => v.dateStart <= v.dateEnd, { message: "dateStart must be on or before dateEnd", path: ["dateEnd"] })
  .refine((v) => daysBetween(v.dateStart, v.dateEnd) <= MAX_RANGE_DAYS, {
    message: `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
    path: ["dateEnd"],
  });
