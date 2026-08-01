import type { ReactNode } from "react";
import type {
  ColumnDef,
  ColumnHighlightState,
  ColumnOrderState,
  ColumnPinningState,
  ColumnVisibilityState,
  ColumnWidthState,
  Density,
  GridLayoutState,
  RowDetailStates,
  SortState,
  TotalsScope,
} from "./types";

/* ------------------------------------------------------------------ */
/* TreeDataTable — expansion as a *continuation of the table*:         */
/* children are rows of the same type rendered under the same columns. */
/* ------------------------------------------------------------------ */

export interface TreeColumnDef<T> extends ColumnDef<T> {
  /**
   * Row-level info tooltip: return the tooltip body to render an "ⓘ" trigger
   * after the cell content (e.g. a per-region breakdown of the value, or a
   * "View details" teaser). Return `null`/`undefined` to omit the icon for
   * that row. Content may be interactive (links/buttons stay reachable).
   */
  infoTip?: (row: T, rowId: string) => ReactNode;
  /** Accessible name for the info trigger (default "Details for <label>"). */
  infoTipLabel?: string;
}

/** Async child states — `D` is the children array of the parent row. */
export type RowChildrenStates<T> = RowDetailStates<T[]>;

export interface ChildrenLoadingContext<T> {
  row: T;
  rowId: string;
  /** Restart the request (supersedes and aborts the in-flight one). */
  reload: () => void;
  /** Collapse the parent row. */
  collapse: () => void;
}

export interface ChildrenErrorContext<T> extends ChildrenLoadingContext<T> {
  error: unknown;
}

export interface TreeDataTableProps<T> {
  /** Root rows. Children come from `getRowChildren` / `loadRowChildren`. */
  data: T[];
  columns: TreeColumnDef<T>[];
  /**
   * Stable unique id per row across the whole tree (parents and children).
   * `index` is the row's position within its sibling group — do not derive
   * ids from it.
   */
  getRowId: (row: T, index: number) => string;

  /* ----- children (sync) ----- */
  /** Synchronous children accessor. Rows with a non-empty result expand. */
  getRowChildren?: (row: T) => readonly T[] | null | undefined;

  /* ----- children (async) ----- */
  /**
   * Async children loader. The grid manages per-row idle/loading/success/
   * error state and renders inline loading/error rows under the parent.
   * `ctx.signal` aborts when the request is superseded or the grid unmounts.
   * Ignored when `getRowChildren` is provided.
   */
  loadRowChildren?: (
    row: T,
    rowId: string,
    ctx: { signal?: AbortSignal }
  ) => Promise<T[]>;
  /** Per-row opt-out / opt-in override for the expand control. */
  getRowCanExpand?: (row: T) => boolean;
  /** Custom inline loading row content. */
  renderChildrenLoading?: (ctx: ChildrenLoadingContext<T>) => ReactNode;
  /** Custom inline error row content (receives `reload`). */
  renderChildrenError?: (ctx: ChildrenErrorContext<T>) => ReactNode;
  /** Controlled async children states (the grid will not fetch in this mode). */
  rowChildrenStates?: RowChildrenStates<T>;
  onRowChildrenStatesChange?: (states: RowChildrenStates<T>) => void;
  /** Called by `reload` in controlled async mode. */
  onRowChildrenReload?: (row: T, rowId: string) => void;

  /* ----- expansion ----- */
  expandedRowIds?: ReadonlySet<string>;
  onExpandedRowIdsChange?: (ids: ReadonlySet<string>) => void;
  defaultExpandedRowIds?: ReadonlySet<string>;
  /** Fired when a row transitions to expanded (fire-and-forget hook). */
  onRowExpand?: (row: T) => void | Promise<void>;

  /* ----- tree presentation ----- */
  /** Column that renders the expand chevron + indentation (default: first column). */
  treeColumnId?: string;
  /** Indent per depth level in px (default 24). */
  indentSize?: number;

  /* ----- layout / virtualization (same semantics as DataTable) ----- */
  height?: number | string;
  rowHeight?: number;
  density?: Density;
  overscan?: number;
  disableVirtualization?: boolean;

  /* ----- loading ----- */
  isLoading?: boolean;
  skeletonRowCount?: number;

  /* ----- sorting (applied independently to every sibling group) ----- */
  sorting?: SortState[];
  onSortingChange?: (sorting: SortState[]) => void;
  defaultSorting?: SortState[];
  multiSort?: boolean;

  /* ----- search (tree-aware: ancestors of matches stay visible and
           matching branches are revealed under collapsed parents) ----- */
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  defaultSearchValue?: string;

  /* ----- column order / pinning / widths / visibility / highlight ----- */
  columnOrder?: ColumnOrderState;
  onColumnOrderChange?: (order: ColumnOrderState) => void;
  defaultColumnOrder?: ColumnOrderState;
  enableColumnReorder?: boolean;
  columnPinning?: ColumnPinningState;
  onColumnPinningChange?: (state: ColumnPinningState) => void;
  defaultColumnPinning?: ColumnPinningState;
  columnWidths?: ColumnWidthState;
  onColumnWidthsChange?: (widths: ColumnWidthState) => void;
  defaultColumnWidths?: ColumnWidthState;
  columnVisibility?: ColumnVisibilityState;
  onColumnVisibilityChange?: (state: ColumnVisibilityState) => void;
  defaultColumnVisibility?: ColumnVisibilityState;
  showColumnsPanel?: boolean;
  columnHighlights?: ColumnHighlightState;
  onColumnHighlightsChange?: (state: ColumnHighlightState) => void;
  defaultColumnHighlights?: ColumnHighlightState;
  highlightTotals?: boolean;

  /* ----- column menu / portals ----- */
  enableColumnMenu?: boolean;
  /** Portal target for menus, panels and tooltips (default `document.body`). */
  menuPortalContainer?: HTMLElement | null;

  /* ----- layout persistence ----- */
  defaultLayout?: GridLayoutState | null;
  onLayoutChange?: (layout: GridLayoutState) => void;

  /* ----- grand total (computed over ROOT rows only) ----- */
  showGrandTotal?: boolean;
  grandTotalLabel?: ReactNode;
  totalsScope?: TotalsScope;

  /* ----- empty states ----- */
  emptyMessage?: ReactNode;
  noResultsMessage?: ReactNode;

  /* ----- misc ----- */
  className?: string;
  toolbarStart?: ReactNode;
  toolbarEnd?: ReactNode;
  onRowClick?: (row: T) => void;
  ariaLabel?: string;
}