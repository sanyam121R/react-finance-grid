import { useCallback, useMemo, useRef } from "react";
import type { ColumnDef, PinSide } from "../types";
import {
  clampWidth,
  computeColumnLayout,
  DEFAULT_MIN_WIDTH,
  DEFAULT_WIDTH,
  EXPANDER_WIDTH,
  RESIZE_KEYBOARD_STEP,
  type LayoutColumn,
} from "../utils/layout";

export interface ResolvedColumn<T> extends LayoutColumn {
  def: ColumnDef<T>;
}

interface Options<T> {
  /** Already ordered + visibility-filtered columns. */
  columns: ColumnDef<T>[];
  /** User width overrides. */
  widths: Record<string, number>;
  pinOf: (columnId: string) => PinSide | false;
  containerWidth: number;
  hasExpander: boolean;
  setColumnWidth: (columnId: string, width: number) => void;
}

export interface ColumnLayoutApi<T> {
  columns: ResolvedColumn<T>[];
  totalWidth: number;
  startResizeDrag: (columnId: string, clientX: number) => void;
  nudgeColumnWidth: (columnId: string, direction: 1 | -1) => void;
}

/**
 * Turns ordered columns + layout state into resolved widths and sticky
 * offsets ("pin in place"), and owns resize interactions.
 */
export function useColumnLayout<T>(opts: Options<T>): ColumnLayoutApi<T> {
  const { columns, widths, pinOf, containerWidth, hasExpander, setColumnWidth } = opts;

  const layout = useMemo(() => {
    const result = computeColumnLayout(
      columns.map((c) => ({
        id: c.id,
        width: c.width,
        minWidth: c.minWidth,
        maxWidth: c.maxWidth,
        stretch: c.stretch,
        pin: pinOf(c.id),
      })),
      widths,
      containerWidth,
      hasExpander ? EXPANDER_WIDTH : 0
    );
    const byId = new Map(columns.map((c) => [c.id, c]));
    const resolved: ResolvedColumn<T>[] = result.columns.map((lc) => ({
      ...lc,
      def: byId.get(lc.id) as ColumnDef<T>,
    }));
    return { resolved, totalWidth: result.totalWidth };
  }, [columns, widths, pinOf, containerWidth, hasExpander]);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

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
        setColumnWidth(
          columnId,
          clampWidth(startWidth + factor * (e.clientX - clientX), min, max)
        );
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
      setColumnWidth(
        columnId,
        clampWidth(
          (col.width || DEFAULT_WIDTH) + direction * RESIZE_KEYBOARD_STEP,
          col.def.minWidth ?? DEFAULT_MIN_WIDTH,
          col.def.maxWidth ?? Number.POSITIVE_INFINITY
        )
      );
    },
    [setColumnWidth]
  );

  return {
    columns: layout.resolved,
    totalWidth: layout.totalWidth,
    startResizeDrag,
    nudgeColumnWidth,
  };
}