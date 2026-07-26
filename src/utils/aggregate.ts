import type { ColumnDef } from "../types";
import { getCellValue } from "./accessors";

/** Compute a column's grand-total value over the given rows. */
export function aggregateRows<T>(
  column: ColumnDef<T>,
  rows: T[]
): number | null {
  const agg = column.aggregate;
  if (!agg) return null;
  if (typeof agg === "function") return agg(rows);
  if (agg === "count") return rows.length;

  const nums: number[] = [];
  for (const row of rows) {
    const v = getCellValue(column, row);
    if (typeof v === "number" && !Number.isNaN(v)) nums.push(v);
  }
  if (nums.length === 0) return null;

  switch (agg) {
    case "sum":
      return nums.reduce((s, n) => s + n, 0);
    case "avg":
      return nums.reduce((s, n) => s + n, 0) / nums.length;
    case "min":
      return Math.min(...nums);
    case "max":
      return Math.max(...nums);
  }
}

export function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}