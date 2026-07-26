import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import type { SortState } from "../types";
import type { ResolvedColumn } from "../hooks/useColumnLayout";
import { clsx } from "../utils/clsx";
import { PinIcon, SortIcon } from "./icons";

interface HeaderCellProps<T> {
  col: ResolvedColumn<T>;
  sort: SortState | null;
  onSortToggle: (columnId: string) => void;
  onPinToggle: (columnId: string) => void;
  onResizeDragStart: (columnId: string, clientX: number) => void;
  onResizeNudge: (columnId: string, direction: 1 | -1) => void;
}

export function pinnedCellStyle<T>(col: ResolvedColumn<T>): CSSProperties {
  const style: CSSProperties = {
    width: col.width,
    minWidth: col.width,
    maxWidth: col.width,
  };
  if (col.pin === "left") style.left = col.offset;
  if (col.pin === "right") style.right = col.offset;
  return style;
}

export function pinnedCellClass<T>(col: ResolvedColumn<T>): string {
  return clsx(
    col.pin === "left" && "rfg-cell--pin-left",
    col.pin === "right" && "rfg-cell--pin-right",
    col.isLastLeftPinned && "rfg-cell--pin-left-last",
    col.isFirstRightPinned && "rfg-cell--pin-right-first"
  );
}

export function HeaderCell<T>({
  col,
  sort,
  onSortToggle,
  onPinToggle,
  onResizeDragStart,
  onResizeNudge,
}: HeaderCellProps<T>) {
  const { def } = col;
  const sortDirection = sort?.columnId === def.id ? sort.direction : null;
  const sortable = def.sortable !== false;
  const pinnable = def.pinnable !== false;
  const resizable = def.resizable !== false;
  const isPinned = col.pin !== false;

  const headerContent: ReactNode =
    typeof def.header === "function"
      ? def.header({ column: def, sortDirection, pinned: col.pin })
      : (def.header ?? def.id);

  const onResizeKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onResizeNudge(def.id, 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onResizeNudge(def.id, -1);
    }
  };

  return (
    <div
      role="columnheader"
      aria-sort={
        sortDirection === "asc"
          ? "ascending"
          : sortDirection === "desc"
            ? "descending"
            : sortable
              ? "none"
              : undefined
      }
      data-column-id={def.id}
      className={clsx(
        "rfg-cell rfg-header-cell",
        pinnedCellClass(col),
        def.align === "right" && "rfg-cell--right",
        def.align === "center" && "rfg-cell--center",
        def.headerClassName
      )}
      style={pinnedCellStyle(col)}
    >
      <span
        className="rfg-header-title"
        title={typeof headerContent === "string" ? headerContent : undefined}
      >
        {headerContent}
      </span>

      <span className="rfg-header-actions">
        {sortable && (
          <button
            type="button"
            className={clsx(
              "rfg-icon-btn",
              sortDirection && "rfg-icon-btn--active"
            )}
            aria-label={`Sort by ${def.id}${
              sortDirection === "asc"
                ? " (currently ascending)"
                : sortDirection === "desc"
                  ? " (currently descending)"
                  : ""
            }`}
            data-testid={`sort-${def.id}`}
            onClick={() => onSortToggle(def.id)}
          >
            <SortIcon dir={sortDirection} />
          </button>
        )}
        {pinnable && (
          <button
            type="button"
            className={clsx("rfg-icon-btn", isPinned && "rfg-icon-btn--active")}
            aria-label={isPinned ? `Unpin ${def.id}` : `Pin ${def.id}`}
            aria-pressed={isPinned}
            data-testid={`pin-${def.id}`}
            onClick={() => onPinToggle(def.id)}
          >
            <PinIcon pinned={isPinned} />
          </button>
        )}
      </span>

      {resizable && (
        <button
          type="button"
          className="rfg-resize-handle"
          aria-label={`Resize ${def.id} column`}
          data-testid={`resize-${def.id}`}
          onKeyDown={onResizeKeyDown}
          onClick={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResizeDragStart(def.id, e.clientX);
          }}
        />
      )}
    </div>
  );
}