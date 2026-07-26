import type { Align, ColumnDef } from "../types";
import { getCellValue } from "./accessors";

const SAMPLE_SIZE = 20;

/**
 * Numeric columns default to right alignment. An explicit `align` always wins;
 * otherwise the first non-null value in a small sample decides.
 */
export function inferAlign<T>(column: ColumnDef<T>, data: T[]): Align {
  if (column.align) return column.align;
  const limit = Math.min(data.length, SAMPLE_SIZE);
  for (let i = 0; i < limit; i++) {
    const value = getCellValue(column, data[i] as T);
    if (value === null || value === undefined || value === "") continue;
    return typeof value === "number" ? "right" : "left";
  }
  return "left";
}

export function buildAlignMap<T>(
  columns: ColumnDef<T>[],
  data: T[]
): Record<string, Align> {
  const out: Record<string, Align> = {};
  for (const c of columns) out[c.id] = inferAlign(c, data);
  return out;
}