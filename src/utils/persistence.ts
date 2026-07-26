import {
    LAYOUT_VERSION,
    type ColumnHighlightState,
    type ColumnPinningState,
    type ColumnVisibilityState,
    type ColumnWidthState,
    type GridLayoutState,
    type SortState,
  } from "../types";
  
  export function createEmptyLayout(): GridLayoutState {
    return {
      version: LAYOUT_VERSION,
      columnOrder: [],
      columnPinning: { left: [], right: [] },
      columnWidths: {},
      columnVisibility: {},
      columnHighlights: {},
      sorting: [],
    };
  }
  
  /** Serialize a layout snapshot to a JSON string (storage-agnostic). */
  export function serializeLayout(layout: GridLayoutState): string {
    return JSON.stringify(layout);
  }
  
  function isStringArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.every((x) => typeof x === "string");
  }
  
  function sanitizeSorting(value: unknown): SortState[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (s): s is SortState =>
        Boolean(s) &&
        typeof (s as SortState).columnId === "string" &&
        ((s as SortState).direction === "asc" || (s as SortState).direction === "desc")
    );
  }
  
  function sanitizeRecord<V>(
    value: unknown,
    isValid: (v: unknown) => v is V
  ): Record<string, V> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: Record<string, V> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isValid(v)) out[k] = v;
    }
    return out;
  }
  
  /**
   * Parse/validate a persisted layout. Returns `null` for malformed input or a
   * mismatched major version, so callers can fall back to defaults safely.
   */
  export function parseLayout(
    input: string | GridLayoutState | null | undefined
  ): GridLayoutState | null {
    if (!input) return null;
    let raw: unknown = input;
    if (typeof input === "string") {
      try {
        raw = JSON.parse(input);
      } catch {
        return null;
      }
    }
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Partial<GridLayoutState>;
    if (typeof obj.version !== "number" || obj.version !== LAYOUT_VERSION) {
      return null;
    }
  
    const pinning = (obj.columnPinning ?? {}) as Partial<ColumnPinningState>;
    const layout: GridLayoutState = {
      version: LAYOUT_VERSION,
      columnOrder: isStringArray(obj.columnOrder) ? obj.columnOrder : [],
      columnPinning: {
        left: isStringArray(pinning.left) ? pinning.left : [],
        right: isStringArray(pinning.right) ? pinning.right : [],
      },
      columnWidths: sanitizeRecord<number>(
        obj.columnWidths,
        (v): v is number => typeof v === "number" && Number.isFinite(v)
      ) as ColumnWidthState,
      columnVisibility: sanitizeRecord<boolean>(
        obj.columnVisibility,
        (v): v is boolean => typeof v === "boolean"
      ) as ColumnVisibilityState,
      columnHighlights: sanitizeRecord<GridLayoutState["columnHighlights"][string]>(
        obj.columnHighlights,
        (v): v is GridLayoutState["columnHighlights"][string] =>
          typeof v === "string" &&
          ["none", "blue", "green", "yellow", "red", "purple"].includes(v)
      ) as ColumnHighlightState,
      sorting: sanitizeSorting(obj.sorting),
    };
    return layout;
  }
  
  /**
   * Drop ids that are not part of the current column set and append any new
   * columns, so persisted layouts survive schema changes.
   */
  export function reconcileLayout(
    layout: GridLayoutState,
    knownColumnIds: string[]
  ): GridLayoutState {
    const known = new Set(knownColumnIds);
    const order = layout.columnOrder.filter((id) => known.has(id));
    for (const id of knownColumnIds) if (!order.includes(id)) order.push(id);
  
    const filterRecord = <V>(rec: Record<string, V>): Record<string, V> =>
      Object.fromEntries(Object.entries(rec).filter(([id]) => known.has(id)));
  
    return {
      version: LAYOUT_VERSION,
      columnOrder: order,
      columnPinning: {
        left: layout.columnPinning.left.filter((id) => known.has(id)),
        right: layout.columnPinning.right.filter((id) => known.has(id)),
      },
      columnWidths: filterRecord(layout.columnWidths),
      columnVisibility: filterRecord(layout.columnVisibility),
      columnHighlights: filterRecord(layout.columnHighlights),
      sorting: layout.sorting.filter((s) => known.has(s.columnId)),
    };
  }