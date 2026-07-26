import { useMemo } from "react";

export interface VirtualItem {
  index: number;
  start: number;
  height: number;
}

interface Options {
  /** Per-item heights in order (rows and expanded panels may differ). */
  heights: number[];
  scrollTop: number;
  viewportHeight: number;
  overscan: number;
  disabled?: boolean;
}

/**
 * Minimal windowing engine: prefix-sum offsets + binary search for the first
 * visible item. O(log n) per scroll frame; handles mixed item heights
 * (data rows vs. declared-height expanded panels).
 */
export function useVirtualRows({
  heights,
  scrollTop,
  viewportHeight,
  overscan,
  disabled,
}: Options): { items: VirtualItem[]; totalHeight: number } {
  const offsets = useMemo(() => {
    const out = new Array<number>(heights.length + 1);
    out[0] = 0;
    for (let i = 0; i < heights.length; i++) {
      out[i + 1] = (out[i] as number) + (heights[i] as number);
    }
    return out;
  }, [heights]);

  const totalHeight = offsets[heights.length] ?? 0;

  const items = useMemo<VirtualItem[]>(() => {
    const count = heights.length;
    if (count === 0) return [];
    if (disabled) {
      return heights.map((h, i) => ({
        index: i,
        start: offsets[i] as number,
        height: h,
      }));
    }

    // Binary search: first item whose bottom edge is below scrollTop.
    let lo = 0;
    let hi = count - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((offsets[mid + 1] as number) <= scrollTop) lo = mid + 1;
      else hi = mid;
    }
    const first = Math.max(0, lo - overscan);

    const bottom = scrollTop + viewportHeight;
    let last = lo;
    while (last < count && (offsets[last] as number) < bottom) last++;
    last = Math.min(count, last + overscan);

    const out: VirtualItem[] = [];
    for (let i = first; i < last; i++) {
      out.push({
        index: i,
        start: offsets[i] as number,
        height: heights[i] as number,
      });
    }
    return out;
  }, [heights, offsets, scrollTop, viewportHeight, overscan, disabled]);

  return { items, totalHeight };
}   