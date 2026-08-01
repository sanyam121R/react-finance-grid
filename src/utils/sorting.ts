import type { ColumnDef, SortDirection, SortState } from "../types";
import { getCellValue } from "./accessors";
import { defaultCompare } from "./compare";

/** Build a comparator chain honouring a multi-sort list. */
export function makeSortComparator<T>(
  sorting: SortState[],
  columns: ColumnDef<T>[]
): ((a: T, b: T) => number) | null {
  const entries = sorting
    .map((s) => ({ s, col: columns.find((c) => c.id === s.columnId) }))
    .filter((e): e is { s: SortState; col: ColumnDef<T> } => Boolean(e.col));
  if (entries.length === 0) return null;

  return (a: T, b: T) => {
    for (const { s, col } of entries) {
      const base = col.sortFn
        ? col.sortFn(a, b)
        : defaultCompare(getCellValue(col, a), getCellValue(col, b));
      if (base !== 0) return s.direction === "asc" ? base : -base;
    }
    return 0;
  };
}

/**
 * Single-sort cycle: asc -> desc -> off for the clicked column.
 */
export function cycleSingleSort(
  sorting: SortState[],
  columnId: string
): SortState[] {
  // Cycle from the column's current direction even when it is part of a
  // multi-sort chain (a plain click collapses the chain to a single sort).
  const current = sorting.find((s) => s.columnId === columnId);
  if (!current) return [{ columnId, direction: "asc" }];
  if (current.direction === "asc") return [{ columnId, direction: "desc" }];
  return [];
}
/**
 * Multi-sort cycle: appends the column to the chain, then cycles
 * asc -> desc -> removed, keeping the rest of the chain intact.
 */
export function cycleMultiSort(
  sorting: SortState[],
  columnId: string
): SortState[] {
  const index = sorting.findIndex((s) => s.columnId === columnId);
  if (index === -1) return [...sorting, { columnId, direction: "asc" }];
  const entry = sorting[index]!;
  if (entry.direction === "asc") {
    const next = [...sorting];
    next[index] = { columnId, direction: "desc" };
    return next;
  }
  return sorting.filter((s) => s.columnId !== columnId);
}

/** Set (or replace) a single column's direction, dropping any other sorts. */
export function setSingleSort(
  columnId: string,
  direction: SortDirection
): SortState[] {
  return [{ columnId, direction }];
}

/** Add/replace a column inside an existing multi-sort chain. */
export function addSort(
  sorting: SortState[],
  columnId: string,
  direction: SortDirection
): SortState[] {
  const next = sorting.filter((s) => s.columnId !== columnId);
  next.push({ columnId, direction });
  return next;
}

export function removeSort(sorting: SortState[], columnId: string): SortState[] {
  return sorting.filter((s) => s.columnId !== columnId);
}