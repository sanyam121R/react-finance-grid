/**
 * Smart default comparator (ascending): numbers, booleans and Dates compare
 * natively; everything else falls back to a numeric-aware locale compare.
 * Null/undefined/empty values always sort last.
 */
export function defaultCompare(a: unknown, b: unknown): number {
    const aNil = a === null || a === undefined || a === "";
    const bNil = b === null || b === undefined || b === "";
    if (aNil && bNil) return 0;
    if (aNil) return 1;
    if (bNil) return -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean") {
      return Number(a) - Number(b);
    }
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
    return String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }