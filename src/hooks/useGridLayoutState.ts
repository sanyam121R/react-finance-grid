import { useCallback, useMemo, useRef } from "react";
import {
  LAYOUT_VERSION,
  type ColumnDef,
  type ColumnHighlightState,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnVisibilityState,
  type ColumnWidthState,
  type GridLayoutState,
  type HighlightColor,
  type PinSide,
} from "../types";
import { useControllableState } from "./useControllableState";
import { parseLayout, reconcileLayout } from "../utils/persistence";

export interface GridLayoutStateOptions<T> {
  columns: ColumnDef<T>[];
  defaultLayout?: GridLayoutState | null;

  columnOrder?: ColumnOrderState;
  onColumnOrderChange?: (order: ColumnOrderState) => void;
  defaultColumnOrder?: ColumnOrderState;

  columnPinning?: ColumnPinningState;
  onColumnPinningChange?: (state: ColumnPinningState) => void;
  defaultColumnPinning?: ColumnPinningState;

  columnWidths?: ColumnWidthState;
  onColumnWidthsChange?: (widths: ColumnWidthState) => void;
  defaultColumnWidths?: ColumnWidthState;

  columnVisibility?: ColumnVisibilityState;
  onColumnVisibilityChange?: (state: ColumnVisibilityState) => void;
  defaultColumnVisibility?: ColumnVisibilityState;

  columnHighlights?: ColumnHighlightState;
  onColumnHighlightsChange?: (state: ColumnHighlightState) => void;
  defaultColumnHighlights?: ColumnHighlightState;
}

export interface GridLayoutStateApi<T> {
  /** Columns in user order, hidden ones removed. */
  orderedVisibleColumns: ColumnDef<T>[];
  /** Columns in user order, including hidden ones (for the columns panel). */
  orderedColumns: ColumnDef<T>[];

  order: ColumnOrderState;
  pinning: ColumnPinningState;
  widths: ColumnWidthState;
  visibility: ColumnVisibilityState;
  highlights: ColumnHighlightState;

  pinOf: (columnId: string) => PinSide | false;
  isVisible: (columnId: string) => boolean;
  highlightOf: (columnId: string) => HighlightColor;

  /** Pin to a side, or unpin with `false`. Never changes column position. */
  setPin: (columnId: string, side: PinSide | false) => void;
  /** Toggle pinning; pins to the column's preferred side (default "left"). */
  togglePin: (columnId: string, side?: PinSide) => void;

  /** Move a column one movable/visible slot left (-1) or right (+1). */
  moveColumn: (columnId: string, direction: -1 | 1) => void;
  /** Drag-and-drop reorder: place `dragId` before/after `targetId`. */
  reorderColumn: (dragId: string, targetId: string) => void;
  canMove: (columnId: string, direction: -1 | 1) => boolean;

  setColumnWidth: (columnId: string, width: number) => void;
  resetColumnWidth: (columnId: string) => void;

  setVisibility: (columnId: string, visible: boolean) => void;
  toggleVisibility: (columnId: string) => void;
  showAllColumns: () => void;

  setHighlight: (columnId: string, color: HighlightColor) => void;
  clearHighlight: (columnId: string) => void;

  /** Layout snapshot without sorting (DataTable adds sorting). */
  snapshot: () => Omit<GridLayoutState, "sorting" | "version">;
  restore: (layout: GridLayoutState) => void;
  reset: () => void;
}

export function useGridLayoutState<T>(
  opts: GridLayoutStateOptions<T>
): GridLayoutStateApi<T> {
  const { columns, defaultLayout } = opts;

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  /** Initial (uncontrolled) values: defaultLayout > default* props > column defs. */
  const initial = useMemo(() => {
    const parsed = defaultLayout ? parseLayout(defaultLayout) : null;
    const layout = parsed ? reconcileLayout(parsed, columnIds) : null;
    return {
      order:
        layout?.columnOrder ??
        opts.defaultColumnOrder ??
        columnIds,
      pinning:
        layout?.columnPinning ??
        opts.defaultColumnPinning ?? {
          left: columns.filter((c) => c.pin === "left").map((c) => c.id),
          right: columns.filter((c) => c.pin === "right").map((c) => c.id),
        },
      widths: layout?.columnWidths ?? opts.defaultColumnWidths ?? {},
      visibility:
        layout?.columnVisibility ??
        opts.defaultColumnVisibility ??
        Object.fromEntries(
          columns.filter((c) => c.hidden).map((c) => [c.id, false])
        ),
      highlights:
        layout?.columnHighlights ??
        opts.defaultColumnHighlights ??
        Object.fromEntries(
          columns
            .filter((c) => c.highlight && c.highlight !== "none")
            .map((c) => [c.id, c.highlight as HighlightColor])
        ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [order, setOrder] = useControllableState<ColumnOrderState>(
    opts.columnOrder,
    opts.onColumnOrderChange,
    initial.order
  );
  const [pinning, setPinning] = useControllableState<ColumnPinningState>(
    opts.columnPinning,
    opts.onColumnPinningChange,
    initial.pinning
  );
  const [widths, setWidths] = useControllableState<ColumnWidthState>(
    opts.columnWidths,
    opts.onColumnWidthsChange,
    initial.widths
  );
  const [visibility, setVisibilityState] = useControllableState<ColumnVisibilityState>(
    opts.columnVisibility,
    opts.onColumnVisibilityChange,
    initial.visibility
  );
  const [highlights, setHighlights] = useControllableState<ColumnHighlightState>(
    opts.columnHighlights,
    opts.onColumnHighlightsChange,
    initial.highlights
  );

  /* ---------------- derived ---------------- */
  const byId = useMemo(
    () => new Map(columns.map((c) => [c.id, c])),
    [columns]
  );

  /** Full order: persisted order first, then any columns added since. */
  const effectiveOrder = useMemo(() => {
    const known = order.filter((id) => byId.has(id));
    for (const id of columnIds) if (!known.includes(id)) known.push(id);
    return known;
  }, [order, byId, columnIds]);

  const isVisible = useCallback(
    (columnId: string) => visibility[columnId] !== false,
    [visibility]
  );

  const orderedColumns = useMemo(
    () => effectiveOrder.map((id) => byId.get(id)).filter((c): c is ColumnDef<T> => Boolean(c)),
    [effectiveOrder, byId]
  );

  const orderedVisibleColumns = useMemo(
    () => orderedColumns.filter((c) => isVisible(c.id)),
    [orderedColumns, isVisible]
  );

  const pinOf = useCallback(
    (columnId: string): PinSide | false =>
      pinning.left.includes(columnId)
        ? "left"
        : pinning.right.includes(columnId)
          ? "right"
          : false,
    [pinning]
  );

  const highlightOf = useCallback(
    (columnId: string): HighlightColor => highlights[columnId] ?? "none",
    [highlights]
  );

  /* ---------------- pinning (in place) ---------------- */
  const setPin = useCallback(
    (columnId: string, side: PinSide | false) => {
      const left = pinning.left.filter((id) => id !== columnId);
      const right = pinning.right.filter((id) => id !== columnId);
      if (side === "left") left.push(columnId);
      if (side === "right") right.push(columnId);
      setPinning({ left, right });
    },
    [pinning, setPinning]
  );

  const togglePin = useCallback(
    (columnId: string, side?: PinSide) => {
      const current = pinOf(columnId);
      if (side) {
        setPin(columnId, current === side ? false : side);
        return;
      }
      const preferred: PinSide =
        byId.get(columnId)?.pin === "right" ? "right" : "left";
      setPin(columnId, current === false ? preferred : false);
    },
    [pinOf, setPin, byId]
  );

  /* ---------------- ordering ---------------- */
  const movableTargetIndex = useCallback(
    (columnId: string, direction: -1 | 1): number => {
      // Operate on visible columns so moves feel 1:1 with what the user sees.
      const visibleIds = orderedVisibleColumns.map((c) => c.id);
      const from = visibleIds.indexOf(columnId);
      if (from === -1) return -1;
      let i = from + direction;
      while (i >= 0 && i < visibleIds.length) {
        const candidate = byId.get(visibleIds[i]!);
        if (candidate && candidate.movable !== false) return i;
        i += direction;
      }
      return -1;
    },
    [orderedVisibleColumns, byId]
  );

  const canMove = useCallback(
    (columnId: string, direction: -1 | 1) => {
      if (byId.get(columnId)?.movable === false) return false;
      return movableTargetIndex(columnId, direction) !== -1;
    },
    [byId, movableTargetIndex]
  );

  const moveColumn = useCallback(
    (columnId: string, direction: -1 | 1) => {
      if (!canMove(columnId, direction)) return;
      const visibleIds = orderedVisibleColumns.map((c) => c.id);
      const targetVisibleIndex = movableTargetIndex(columnId, direction);
      const targetId = visibleIds[targetVisibleIndex]!;
      const next = [...effectiveOrder];
      const from = next.indexOf(columnId);
      const to = next.indexOf(targetId);
      next.splice(from, 1);
      next.splice(to, 0, columnId);
      setOrder(next);
    },
    [canMove, orderedVisibleColumns, movableTargetIndex, effectiveOrder, setOrder]
  );

  const reorderColumn = useCallback(
    (dragId: string, targetId: string) => {
      if (dragId === targetId) return;
      if (byId.get(dragId)?.movable === false) return;
      if (byId.get(targetId)?.movable === false) return;
      const next = [...effectiveOrder];
      const from = next.indexOf(dragId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return;
      next.splice(from, 1);
      // Dragging right: drop after the target; dragging left: drop before it.
      const insertAt = from < to ? next.indexOf(targetId) + 1 : next.indexOf(targetId);
      next.splice(insertAt, 0, dragId);
      setOrder(next);
    },
    [byId, effectiveOrder, setOrder]
  );

  /* ---------------- widths ---------------- */
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const setColumnWidth = useCallback(
    (columnId: string, width: number) => {
      setWidths({ ...widthsRef.current, [columnId]: width });
    },
    [setWidths]
  );

  const resetColumnWidth = useCallback(
    (columnId: string) => {
      const next = { ...widthsRef.current };
      delete next[columnId];
      setWidths(next);
    },
    [setWidths]
  );

  /* ---------------- visibility ---------------- */
  const setVisibility = useCallback(
    (columnId: string, visible: boolean) => {
      if (byId.get(columnId)?.hideable === false && !visible) return;
      setVisibilityState({ ...visibility, [columnId]: visible });
    },
    [byId, visibility, setVisibilityState]
  );

  const toggleVisibility = useCallback(
    (columnId: string) => setVisibility(columnId, !isVisible(columnId)),
    [setVisibility, isVisible]
  );

  const showAllColumns = useCallback(() => {
    setVisibilityState({});
  }, [setVisibilityState]);

  /* ---------------- highlight ---------------- */
  const setHighlight = useCallback(
    (columnId: string, color: HighlightColor) => {
      const next = { ...highlights };
      if (color === "none") delete next[columnId];
      else next[columnId] = color;
      setHighlights(next);
    },
    [highlights, setHighlights]
  );

  const clearHighlight = useCallback(
    (columnId: string) => setHighlight(columnId, "none"),
    [setHighlight]
  );

  /* ---------------- snapshot / restore / reset ---------------- */
  const snapshot = useCallback(
    () => ({
      columnOrder: effectiveOrder,
      columnPinning: { left: [...pinning.left], right: [...pinning.right] },
      columnWidths: { ...widths },
      columnVisibility: { ...visibility },
      columnHighlights: { ...highlights },
    }),
    [effectiveOrder, pinning, widths, visibility, highlights]
  );

  const restore = useCallback(
    (layout: GridLayoutState) => {
      const safe = reconcileLayout(layout, columnIds);
      setOrder(safe.columnOrder);
      setPinning(safe.columnPinning);
      setWidths(safe.columnWidths);
      setVisibilityState(safe.columnVisibility);
      setHighlights(safe.columnHighlights);
    },
    [columnIds, setOrder, setPinning, setWidths, setVisibilityState, setHighlights]
  );

  const reset = useCallback(() => {
    restore({
      version: LAYOUT_VERSION,
      columnOrder: columnIds,
      columnPinning: {
        left: columns.filter((c) => c.pin === "left").map((c) => c.id),
        right: columns.filter((c) => c.pin === "right").map((c) => c.id),
      },
      columnWidths: {},
      columnVisibility: Object.fromEntries(
        columns.filter((c) => c.hidden).map((c) => [c.id, false])
      ),
      columnHighlights: Object.fromEntries(
        columns
          .filter((c) => c.highlight && c.highlight !== "none")
          .map((c) => [c.id, c.highlight as HighlightColor])
      ),
      sorting: [],
    });
  }, [restore, columnIds, columns]);

  return {
    orderedVisibleColumns,
    orderedColumns,
    order: effectiveOrder,
    pinning,
    widths,
    visibility,
    highlights,
    pinOf,
    isVisible,
    highlightOf,
    setPin,
    togglePin,
    moveColumn,
    reorderColumn,
    canMove,
    setColumnWidth,
    resetColumnWidth,
    setVisibility,
    toggleVisibility,
    showAllColumns,
    setHighlight,
    clearHighlight,
    snapshot,
    restore,
    reset,
  };
}