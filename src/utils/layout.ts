import type { PinSide } from "../types";

export const DEFAULT_WIDTH = 160;
export const DEFAULT_MIN_WIDTH = 64;
export const EXPANDER_WIDTH = 40;
export const RESIZE_KEYBOARD_STEP = 16;

export interface LayoutColumnInput {
  id: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  stretch?: boolean;
  /** Pin side in the *current* state (not the initial column def). */
  pin: PinSide | false;
}

export interface LayoutColumn {
  id: string;
  width: number;
  pin: PinSide | false;
  /** Sticky `left` (for left-pinned) or `right` (for right-pinned) offset in px. */
  offset: number;
  isLastLeftPinned: boolean;
  isFirstRightPinned: boolean;
}

export interface LayoutResult {
  /** Columns in render order: left-pinned, unpinned, right-pinned. */
  columns: LayoutColumn[];
  /** Sum of all column widths + leading width. */
  totalWidth: number;
  leftPinnedWidth: number;
  rightPinnedWidth: number;
}

export function clampWidth(
  width: number,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = Number.POSITIVE_INFINITY
): number {
  return Math.min(Math.max(width, minWidth), maxWidth);
}

/**
 * Pure column layout: clamps widths, distributes leftover container space to
 * stretch columns (that the user has not manually resized), and computes
 * sticky offsets for left/right pinned columns.
 *
 * `columns` must already be ordered: left-pinned group, unpinned, right-pinned
 * group. `leadingWidth` reserves space for the always-left-pinned expander.
 */
export function computeColumnLayout(
  columns: LayoutColumnInput[],
  overrides: Record<string, number>,
  containerWidth: number,
  leadingWidth = 0
): LayoutResult {
  const baseOf = (c: LayoutColumnInput): number =>
    clampWidth(overrides[c.id] ?? c.width ?? DEFAULT_WIDTH, c.minWidth, c.maxWidth);

  const widths = new Map<string, number>();
  let total = leadingWidth;
  for (const c of columns) {
    const w = baseOf(c);
    widths.set(c.id, w);
    total += w;
  }

  // Stretch: distribute leftover space proportionally across stretchable,
  // non-user-resized columns; respect maxWidth while distributing.
  if (containerWidth > total) {
    const stretchables = columns.filter(
      (c) => c.stretch !== false && overrides[c.id] === undefined
    );
    const stretchBase = stretchables.reduce((s, c) => s + baseOf(c), 0);
    if (stretchBase > 0) {
      const extra = containerWidth - total;
      let used = 0;
      stretchables.forEach((c, i) => {
        const base = baseOf(c);
        const share =
          i === stretchables.length - 1
            ? extra - used
            : Math.floor((extra * base) / stretchBase);
        const next = clampWidth(base + share, c.minWidth, c.maxWidth);
        used += next - base;
        widths.set(c.id, next);
      });
      total += used;
    }
  }

  const leftCols = columns.filter((c) => c.pin === "left");
  const midCols = columns.filter((c) => c.pin === false);
  const rightCols = columns.filter((c) => c.pin === "right");

  const out: LayoutColumn[] = [];
  let left = leadingWidth;
  leftCols.forEach((c, i) => {
    out.push({
      id: c.id,
      width: widths.get(c.id) ?? DEFAULT_WIDTH,
      pin: "left",
      offset: left,
      isLastLeftPinned: i === leftCols.length - 1,
      isFirstRightPinned: false,
    });
    left += widths.get(c.id) ?? DEFAULT_WIDTH;
  });
  for (const c of midCols) {
    out.push({
      id: c.id,
      width: widths.get(c.id) ?? DEFAULT_WIDTH,
      pin: false,
      offset: 0,
      isLastLeftPinned: false,
      isFirstRightPinned: false,
    });
  }
  // Right offsets accumulate from the right edge inward.
  let right = 0;
  const rightOut: LayoutColumn[] = [];
  for (let i = rightCols.length - 1; i >= 0; i--) {
    const c = rightCols[i]!;
    rightOut.unshift({
      id: c.id,
      width: widths.get(c.id) ?? DEFAULT_WIDTH,
      pin: "right",
      offset: right,
      isLastLeftPinned: false,
      isFirstRightPinned: i === 0,
    });
    right += widths.get(c.id) ?? DEFAULT_WIDTH;
  }
  out.push(...rightOut);

  return {
    columns: out,
    totalWidth: total,
    leftPinnedWidth: left,
    rightPinnedWidth: right,
  };
}