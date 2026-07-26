import type { TableSkeletonProps } from "../types";
import type { ResolvedColumn } from "../hooks/useColumnLayout";
import { EXPANDER_WIDTH } from "../utils/layout";
import { clsx } from "../utils/clsx";
import { pinnedCellClass, pinnedCellStyle } from "./HeaderCell";

/** Internal: skeleton body rows matching the real column structure. */
export function SkeletonRows<T>({
  columns,
  rowCount,
  rowHeight,
  totalWidth,
  hasExpander,
}: {
  columns: ResolvedColumn<T>[];
  rowCount: number;
  rowHeight: number;
  totalWidth: number;
  hasExpander: boolean;
}) {
  return (
    <div role="presentation" aria-hidden="true" data-testid="rfg-skeleton">
      {Array.from({ length: rowCount }, (_, r) => (
        <div
          key={r}
          className="rfg-row rfg-row--static"
          style={{ height: rowHeight, width: totalWidth }}
        >
          {hasExpander && (
            <div
              className="rfg-cell rfg-cell--pin-left rfg-expander-cell"
              style={{ width: EXPANDER_WIDTH, minWidth: EXPANDER_WIDTH, left: 0 }}
            />
          )}
          {columns.map((col) => (
            <div
              key={col.id}
              className={clsx("rfg-cell", pinnedCellClass(col))}
              style={pinnedCellStyle(col)}
            >
              <span
                className="rfg-skeleton-bar"
                style={{ width: `${55 + ((r * 7 + col.width) % 35)}%` }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Standalone table-shaped skeleton. Designed as a `<Suspense fallback>` while
 * a lazy chunk or its data loads:
 *
 * ```tsx
 * <Suspense fallback={<TableSkeleton rows={8} columns={6} />}>
 *   <LazyDashboardTable />
 * </Suspense>
 * ```
 */
export function TableSkeleton({
  rows = 8,
  columns = 5,
  rowHeight = 44,
  height,
  className,
}: TableSkeletonProps) {
  return (
    <div
      className={clsx("rfg-root", className)}
      style={{ height }}
      data-testid="rfg-table-skeleton"
    >
      <div className="rfg-scroll" aria-busy="true" aria-label="Loading table">
        <div className="rfg-header" style={{ height: rowHeight }}>
          {Array.from({ length: columns }, (_, c) => (
            <div key={c} className="rfg-cell rfg-header-cell" style={{ flex: 1 }}>
              <span className="rfg-skeleton-bar" style={{ width: "60%" }} />
            </div>
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="rfg-row rfg-row--static" style={{ height: rowHeight }}>
            {Array.from({ length: columns }, (_, c) => (
              <div key={c} className="rfg-cell" style={{ flex: 1 }}>
                <span
                  className="rfg-skeleton-bar"
                  style={{ width: `${50 + ((r * 13 + c * 29) % 40)}%` }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}