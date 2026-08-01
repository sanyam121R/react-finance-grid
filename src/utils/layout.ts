import type { PinSide } from "../types";

export const DEFAULT_WIDTH = 160;
export const DEFAULT_MIN_WIDTH = 64;
export const EXPANDER_WIDTH = 40;
export const RESIZE_KEYBOARD_STEP = 16;

export const DENSITY_ROW_HEIGHT = {
  compact: 32,
  comfortable: 44,
  spacious: 56,
} as const;

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
  /** Sticky `left` (left-pinned) or `right` (right-pinned) offset in px. */
  offset: number;
  isLastLeftPinned: boolean;
  isFirstRightPinned: boolean;
}

export interface LayoutResult {
  /** Columns in the caller's order — pinning never reorders. */
  columns: LayoutColumn[];
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
 * Pure column layout — **"pin in place" semantics**.
 *
 * Columns are laid out strictly in the order given (user/`columnOrder`
 * defined): pinning never moves a column. A left-pinned column sticks at the
 * cumulative width of the *left-pinned columns that precede it*, so pinned
 * columns stack at the viewport edge in their existing relative order while
 * unpinned columns scroll underneath. Right-pinned columns mirror this from
 * the right edge.
 *
 * `leadingWidth` reserves space for the always-left-stuck expander column.
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

  const lastLeftIndex = columns.reduce(
    (acc, c, i) => (c.pin === "left" ? i : acc),
    -1
  );
  const firstRightIndex = columns.findIndex((c) => c.pin === "right");

  // Left offsets accumulate in order across left-pinned columns only.
  const out: LayoutColumn[] = columns.map((c, i) => ({
    id: c.id,
    width: widths.get(c.id) ?? DEFAULT_WIDTH,
    pin: c.pin,
    offset: 0,
    isLastLeftPinned: i === lastLeftIndex,
    isFirstRightPinned: i === firstRightIndex,
  }));

  let left = leadingWidth;
  for (const col of out) {
    if (col.pin === "left") {
      col.offset = left;
      left += col.width;
    }
  }
  // Right offsets accumulate from the right edge inward.
  let right = 0;
  for (let i = out.length - 1; i >= 0; i--) {
    const col = out[i]!;
    if (col.pin === "right") {
      col.offset = right;
      right += col.width;
    }
  }

  return {
    columns: out,
    totalWidth: total,
    leftPinnedWidth: left,
    rightPinnedWidth: right,
  };
}