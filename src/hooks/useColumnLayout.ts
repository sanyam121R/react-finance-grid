import { useCallback, useMemo, useRef, useState } from "react";
import type { ColumnDef, ColumnPinningState, PinSide } from "../types";
import {
  clampWidth,
  computeColumnLayout,
  DEFAULT_MIN_WIDTH,
  DEFAULT_WIDTH,
  EXPANDER_WIDTH,
  RESIZE_KEYBOARD_STEP,
  type LayoutColumn,
} from "../utils/layout";
import { useControllableState } from "./useControllableState";

export interface ResolvedColumn<T> extends LayoutColumn {
  def: ColumnDef<T>;
}

interface Options<T> {
  columns: ColumnDef<T>[];
  containerWidth: number;
  hasExpander: boolean;
  columnPinning?: ColumnPinningState;
  onColumnPinningChange?: (state: ColumnPinningState) => void;
}

export interface ColumnLayoutApi<T> {
  columns: ResolvedColumn<T>[];
  totalWidth: number;
  pinning: ColumnPinningState;
  togglePin: (columnId: string) => void;
  startResizeDrag: (columnId: string, clientX: number) => void;
  nudgeColumnWidth: (columnId: string, direction: 1 | -1) => void;
}

export function useColumnLayout<T>(opts: Options<T>): ColumnLayoutApi<T> {
  const { columns, containerWidth, hasExpander } = opts;

  /* ---------------- pinning state (controlled/uncontrolled) ---------------- */
  const [pinning, setPinning] = useControllableState<ColumnPinningState>(
    opts.columnPinning,
    opts.onColumnPinningChange,
    () => ({
      left: columns.filter((c) => c.pin === "left").map((c) => c.id),
      right: columns.filter((c) => c.pin === "right").map((c) => c.id),
    })
  );

  const togglePin = useCallback(
    (columnId: string) => {
      const isLeft = pinning.left.includes(columnId);
      const isRight = pinning.right.includes(columnId);
      if (isLeft || isRight) {
        setPinning({
          left: pinning.left.filter((id) => id !== columnId),
          right: pinning.right.filter((id) => id !== columnId),
        });
        return;
      }
      const target: PinSide =
        columns.find((c) => c.id === columnId)?.pin === "right"
          ? "right"
          : "left";
      setPinning(
        target === "left"
          ? { ...pinning, left: [...pinning.left, columnId] }
          : { ...pinning, right: [...pinning.right, columnId] }
      );
    },
    [pinning, setPinning, columns]
  );

  /* ---------------- user width overrides ---------------- */
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  /* ---------------- ordered columns + pure layout ---------------- */
  const layout = useMemo(() => {
    const pinOf = (c: ColumnDef<T>): PinSide | false =>
      pinning.left.includes(c.id)
        ? "left"
        : pinning.right.includes(c.id)
          ? "right"
          : false;

    const indexIn = (list: string[], id: string) => list.indexOf(id);
    const leftGroup = columns
      .filter((c) => pinOf(c) === "left")
      .sort((a, b) => indexIn(pinning.left, a.id) - indexIn(pinning.left, b.id));
    const rightGroup = columns
      .filter((c) => pinOf(c) === "right")
      .sort((a, b) => indexIn(pinning.right, a.id) - indexIn(pinning.right, b.id));
    const midGroup = columns.filter((c) => pinOf(c) === false);
    const ordered = [...leftGroup, ...midGroup, ...rightGroup];

    const result = computeColumnLayout(
      ordered.map((c) => ({
        id: c.id,
        width: c.width,
        minWidth: c.minWidth,
        maxWidth: c.maxWidth,
        stretch: c.stretch,
        pin: pinOf(c),
      })),
      overrides,
      containerWidth,
      hasExpander ? EXPANDER_WIDTH : 0
    );

    const byId = new Map(columns.map((c) => [c.id, c]));
    const resolved: ResolvedColumn<T>[] = result.columns.map((lc) => ({
      ...lc,
      def: byId.get(lc.id) as ColumnDef<T>,
    }));
    return { resolved, totalWidth: result.totalWidth };
  }, [columns, pinning, overrides, containerWidth, hasExpander]);

  /* ---------------- resize: drag + keyboard ---------------- */
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const setColumnWidth = useCallback((columnId: string, width: number) => {
    setOverrides((prev) => ({ ...prev, [columnId]: width }));
  }, []);

  const startResizeDrag = useCallback(
    (columnId: string, clientX: number) => {
      if (typeof window === "undefined") return;
      const col = layoutRef.current.resolved.find((c) => c.id === columnId);
      if (!col || col.def.resizable === false) return;
      const startWidth = col.width;
      const min = col.def.minWidth ?? DEFAULT_MIN_WIDTH;
      const max = col.def.maxWidth ?? Number.POSITIVE_INFINITY;
      const factor = col.pin === "right" ? -1 : 1;

      const onMove = (e: PointerEvent | MouseEvent) => {
        const next = clampWidth(
          startWidth + factor * (e.clientX - clientX),
          min,
          max
        );
        setColumnWidth(columnId, next);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [setColumnWidth]
  );

  const nudgeColumnWidth = useCallback(
    (columnId: string, direction: 1 | -1) => {
      const col = layoutRef.current.resolved.find((c) => c.id === columnId);
      if (!col || col.def.resizable === false) return;
      const next = clampWidth(
        (col.width || DEFAULT_WIDTH) + direction * RESIZE_KEYBOARD_STEP,
        col.def.minWidth ?? DEFAULT_MIN_WIDTH,
        col.def.maxWidth ?? Number.POSITIVE_INFINITY
      );
      setColumnWidth(columnId, next);
    },
    [setColumnWidth]
  );

  return {
    columns: layout.resolved,
    totalWidth: layout.totalWidth,
    pinning,
    togglePin,
    startResizeDrag,
    nudgeColumnWidth,
  };
}