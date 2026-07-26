import type { ColumnDef } from "../types";

/** Resolve the raw cell value using accessorFn > accessorKey > undefined. */
export function getCellValue<T>(column: ColumnDef<T>, row: T): unknown {
  if (column.accessorFn) return column.accessorFn(row);
  if (column.accessorKey !== undefined) {
    return (row as Record<string, unknown>)[column.accessorKey];
  }
  return undefined;
}

export function getSearchText<T>(column: ColumnDef<T>, row: T): string {
  if (column.getSearchText) return column.getSearchText(row);
  const value = getCellValue(column, row);
  return value === null || value === undefined ? "" : String(value);
}