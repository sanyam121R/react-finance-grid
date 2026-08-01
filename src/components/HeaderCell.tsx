import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { Align, HighlightColor, PinSide, SortDirection } from "../types";
import type { ResolvedColumn } from "../hooks/useColumnLayout";
import { clsx } from "../utils/clsx";
import { GripIcon, MenuIcon, PinIcon, SortIcon } from "./icons";
import { Menu, useMenuId, type MenuGroupDef } from "./Menu";

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  "none",
  "blue",
  "green",
  "yellow",
  "red",
  "purple",
];

const HIGHLIGHT_SWATCH: Record<HighlightColor, string> = {
  none: "transparent",
  blue: "var(--rfg-hl-blue-strong, #3b82f6)",
  green: "var(--rfg-hl-green-strong, #22c55e)",
  yellow: "var(--rfg-hl-yellow-strong, #eab308)",
  red: "var(--rfg-hl-red-strong, #ef4444)",
  purple: "var(--rfg-hl-purple-strong, #a855f7)",
};

export interface HeaderCellActions {
  toggleSort: (columnId: string, additive: boolean) => void;
  setSort: (columnId: string, direction: SortDirection, additive: boolean) => void;
  clearSort: (columnId: string) => void;
  setPin: (columnId: string, side: PinSide | false) => void;
  togglePin: (columnId: string) => void;
  moveColumn: (columnId: string, direction: -1 | 1) => void;
  hideColumn: (columnId: string) => void;
  resetWidth: (columnId: string) => void;
  setHighlight: (columnId: string, color: HighlightColor) => void;
  resizeDragStart: (columnId: string, clientX: number) => void;
  resizeNudge: (columnId: string, direction: 1 | -1) => void;
  dragStart: (columnId: string) => void;
  dragOver: (columnId: string) => void;
  drop: (columnId: string, fallbackDragId?: string) => void;
  dragEnd: () => void;
}

interface HeaderCellProps<T> {
  col: ResolvedColumn<T>;
  align: Align;
  sortDirection: SortDirection | null;
  /** 1-based position in a multi-sort chain (null when not sorted). */
  sortIndex: number | null;
  sortCount: number;
  highlight: HighlightColor;
  hasWidthOverride: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  enableMenu: boolean;
  enableReorder: boolean;
  multiSort: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  actions: HeaderCellActions;
  /** Portal target for the column menu (defaults to document.body). */
  menuPortalContainer?: HTMLElement | null;
  /** Theme class propagated to the portalled menu. */
  portalClassName?: string;
}

export function cellLayoutStyle<T>(col: ResolvedColumn<T>): CSSProperties {
  const style: CSSProperties = {
    width: col.width,
    minWidth: col.width,
    maxWidth: col.width,
  };
  if (col.pin === "left") style.left = col.offset;
  if (col.pin === "right") style.right = col.offset;
  return style;
}

export function cellLayoutClass<T>(
  col: ResolvedColumn<T>,
  highlight: HighlightColor = "none"
): string {
  return clsx(
    col.pin === "left" && "rfg-cell--pin-left",
    col.pin === "right" && "rfg-cell--pin-right",
    col.isLastLeftPinned && "rfg-cell--pin-left-last",
    col.isFirstRightPinned && "rfg-cell--pin-right-first",
    highlight !== "none" && "rfg-cell--highlight",
    highlight !== "none" && `rfg-cell--hl-${highlight}`
  );
}

export function HeaderCell<T>({
  col,
  align,
  sortDirection,
  sortIndex,
  sortCount,
  highlight,
  hasWidthOverride,
  canMoveLeft,
  canMoveRight,
  enableMenu,
  enableReorder,
  multiSort,
  isDragging,
  isDropTarget,
  actions,
  menuPortalContainer,
  portalClassName,
}: HeaderCellProps<T>) {
  const { def } = col;
  const sortable = def.sortable !== false;
  const pinnable = def.pinnable !== false;
  const resizable = def.resizable !== false;
  const movable = def.movable !== false;
  const hideable = def.hideable !== false;
  const highlightable = def.highlightable !== false;
  const showMenu = enableMenu && def.menu !== false;
  const isPinned = col.pin !== false;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useMenuId("rfg-menu-");

  const label =
    def.label ?? (typeof def.header === "string" ? def.header : def.id);

  const headerContent: ReactNode =
    typeof def.header === "function"
      ? def.header({
          column: def,
          sortDirection,
          sortIndex,
          pinned: col.pin,
          highlight,
        })
      : (def.header ?? def.id);

  const onResizeKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      actions.resizeNudge(def.id, 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      actions.resizeNudge(def.id, -1);
    }
  };

  const onGripKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      actions.moveColumn(def.id, -1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      actions.moveColumn(def.id, 1);
    }
  };

  const groups = useMemo<MenuGroupDef[]>(() => {
    const out: MenuGroupDef[] = [];
    if (sortable) {
      const items = [
        {
          id: `sort-asc-${def.id}`,
          label: "Sort ascending",
          active: sortDirection === "asc",
          onSelect: () => actions.setSort(def.id, "asc", false),
        },
        {
          id: `sort-desc-${def.id}`,
          label: "Sort descending",
          active: sortDirection === "desc",
          onSelect: () => actions.setSort(def.id, "desc", false),
        },
        {
          id: `sort-clear-${def.id}`,
          label: "Clear sort",
          disabled: sortDirection === null,
          onSelect: () => actions.clearSort(def.id),
        },
      ];
      if (multiSort) {
        items.push(
          {
            id: `sort-add-asc-${def.id}`,
            label: "Add ascending to sort",
            active: false,
            onSelect: () => actions.setSort(def.id, "asc", true),
          },
          {
            id: `sort-add-desc-${def.id}`,
            label: "Add descending to sort",
            active: false,
            onSelect: () => actions.setSort(def.id, "desc", true),
          }
        );
      }
      out.push({ id: "sort", label: "Sort", items });
    }
    if (pinnable) {
      out.push({
        id: "pin",
        label: "Pin (keeps position)",
        items: [
          {
            id: `pin-left-${def.id}`,
            label: "Pin to left edge",
            active: col.pin === "left",
            onSelect: () =>
              actions.setPin(def.id, col.pin === "left" ? false : "left"),
          },
          {
            id: `pin-right-${def.id}`,
            label: "Pin to right edge",
            active: col.pin === "right",
            onSelect: () =>
              actions.setPin(def.id, col.pin === "right" ? false : "right"),
          },
          {
            id: `unpin-${def.id}`,
            label: "Unpin",
            disabled: !isPinned,
            onSelect: () => actions.setPin(def.id, false),
          },
        ],
      });
    }
    const layoutItems: MenuGroupDef["items"] = [];
    if (movable) {
      layoutItems.push(
        {
          id: `move-left-${def.id}`,
          label: "Move left",
          disabled: !canMoveLeft,
          onSelect: () => actions.moveColumn(def.id, -1),
        },
        {
          id: `move-right-${def.id}`,
          label: "Move right",
          disabled: !canMoveRight,
          onSelect: () => actions.moveColumn(def.id, 1),
        }
      );
    }
    if (resizable) {
      layoutItems.push({
        id: `reset-width-${def.id}`,
        label: "Reset width",
        disabled: !hasWidthOverride,
        onSelect: () => actions.resetWidth(def.id),
      });
    }
    if (hideable) {
      layoutItems.push({
        id: `hide-${def.id}`,
        label: "Hide column",
        // the trigger unmounts with the column — the grid moves focus instead
        restoreFocus: false,
        onSelect: () => actions.hideColumn(def.id),
      });
    }
    if (layoutItems.length > 0) {
      out.push({ id: "layout", label: "Layout", items: layoutItems });
    }
    if (highlightable) {
      out.push({
        id: "highlight",
        label: "Highlight",
        items: HIGHLIGHT_COLORS.map((color) => ({
          id: `highlight-${color}-${def.id}`,
          label: color === "none" ? "Clear highlight" : capitalize(color),
          swatch: HIGHLIGHT_SWATCH[color],
          active: highlight === color,
          onSelect: () => actions.setHighlight(def.id, color),
        })),
      });
    }
    return out;
  }, [
    actions,
    canMoveLeft,
    canMoveRight,
    col.pin,
    def.id,
    hasWidthOverride,
    hideable,
    highlight,
    highlightable,
    isPinned,
    movable,
    multiSort,
    pinnable,
    resizable,
    sortDirection,
    sortable,
  ]);

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
      data-pinned={col.pin === false ? undefined : col.pin}
      data-highlight={highlight === "none" ? undefined : highlight}
      className={clsx(
        "rfg-cell rfg-header-cell",
        cellLayoutClass(col, highlight),
        align === "right" && "rfg-cell--right",
        align === "center" && "rfg-cell--center",
        isDragging && "rfg-header-cell--dragging",
        isDropTarget && "rfg-header-cell--drop-target",
        def.headerClassName
      )}
      style={cellLayoutStyle(col)}
      onDragOver={
        enableReorder
          ? (e) => {
              // preventDefault marks this cell as a valid drop target
              e.preventDefault();
              if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
              actions.dragOver(def.id);
            }
          : undefined
      }
      onDrop={
        enableReorder
          ? (e) => {
              e.preventDefault();
              const transferred = e.dataTransfer?.getData("text/plain");
              actions.drop(def.id, transferred || undefined);
            }
          : undefined
      }
    >
      {enableReorder && movable && (
        <button
          type="button"
          className="rfg-grip"
          draggable
          aria-label={`Reorder ${label} column (use arrow keys to move)`}
          data-testid={`grip-${def.id}`}
          onKeyDown={onGripKeyDown}
          onDragStart={(e) => {
            // Firefox refuses to start a drag unless data is set
            if (e.dataTransfer) {
              e.dataTransfer.setData("text/plain", def.id);
              e.dataTransfer.effectAllowed = "move";
            }
            actions.dragStart(def.id);
          }}
          onDragEnd={() => actions.dragEnd()}
          onClick={(e) => e.preventDefault()}
        >
          <GripIcon />
        </button>
      )}

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
            className={clsx("rfg-icon-btn", sortDirection && "rfg-icon-btn--active")}
            aria-label={`Sort by ${label}${
              sortDirection === "asc"
                ? " (currently ascending)"
                : sortDirection === "desc"
                  ? " (currently descending)"
                  : ""
            }${multiSort ? " — shift-click to add to sort" : ""}`}
            data-testid={`sort-${def.id}`}
            onClick={(e) => actions.toggleSort(def.id, multiSort && e.shiftKey)}
          >
            <SortIcon dir={sortDirection} />
            {sortIndex !== null && sortCount > 1 && (
              <span className="rfg-sort-index" aria-hidden="true">
                {sortIndex}
              </span>
            )}
          </button>
        )}
        {pinnable && (
          <button
            type="button"
            className={clsx(
              "rfg-icon-btn rfg-pin-btn",
              isPinned && "rfg-icon-btn--active rfg-pin-btn--pinned"
            )}
            aria-label={
              isPinned
                ? `Unpin ${label}`
                : `Pin ${label} in place`
            }
            aria-pressed={isPinned}
            data-testid={`pin-${def.id}`}
            onClick={() => actions.togglePin(def.id)}
          >
            <PinIcon pinned={isPinned} side={col.pin === "right" ? "right" : "left"} />
          </button>
        )}
        {showMenu && (
          <button
            ref={menuButtonRef}
            type="button"
            className={clsx("rfg-icon-btn", menuOpen && "rfg-icon-btn--active")}
            aria-label={`${label} column options`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            data-testid={`menu-${def.id}`}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MenuIcon />
          </button>
        )}
      </span>

      {showMenu && (
       <Menu
       id={menuId}
       open={menuOpen}
       onClose={() => setMenuOpen(false)}
       anchorRef={menuButtonRef}
       groups={groups}
       label={`${label} column options`}
       testId={`column-menu-${def.id}`}
       portalContainer={menuPortalContainer}
       portalClassName={portalClassName}
     />
      )}

      {resizable && (
        <button
          type="button"
          className="rfg-resize-handle"
          aria-label={`Resize ${label} column`}
          data-testid={`resize-${def.id}`}
          onKeyDown={onResizeKeyDown}
          onClick={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            actions.resizeDragStart(def.id, e.clientX);
          }}
        />
      )}
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}