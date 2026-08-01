import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Sorting                                                             */
/* ------------------------------------------------------------------ */

export type SortDirection = "asc" | "desc";

export interface SortState {
  columnId: string;
  direction: SortDirection;
}

/* ------------------------------------------------------------------ */
/* Pinning                                                             */
/* ------------------------------------------------------------------ */

export type PinSide = "left" | "right";

/**
 * Pin *membership* only — a pinned column keeps its position in
 * `columnOrder` ("pin in place"). The arrays are sets; their internal order is
 * not significant.
 */
export interface ColumnPinningState {
  left: string[];
  right: string[];
}

/* ------------------------------------------------------------------ */
/* Visibility / sizing / highlight / order                             */
/* ------------------------------------------------------------------ */

export type ColumnOrderState = string[];
/** `false` = hidden. Missing id = visible. */
export type ColumnVisibilityState = Record<string, boolean>;
/** Explicit (user-resized) widths in px, keyed by column id. */
export type ColumnWidthState = Record<string, number>;

export type HighlightColor =
  | "none"
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple";

export type ColumnHighlightState = Record<string, HighlightColor>;

export type Density = "compact" | "comfortable" | "spacious";

/* ------------------------------------------------------------------ */
/* Aggregation (grand total)                                           */
/* ------------------------------------------------------------------ */

/** Custom aggregation — return `null` to render the "empty" total. */
export type AggregateFn<T> = (rows: T[]) => number | null;

export type Aggregate<T> = "sum" | "avg" | "min" | "max" | "count" | AggregateFn<T>;

/** Which dataset grand totals are computed from. */
export type TotalsScope = "filtered" | "all";

/* ------------------------------------------------------------------ */
/* Columns                                                             */
/* ------------------------------------------------------------------ */

export type Align = "left" | "center" | "right";

export interface HeaderContext<T> {
  column: ColumnDef<T>;
  sortDirection: SortDirection | null;
  /** 1-based position in a multi-sort chain, or `null`. */
  sortIndex: number | null;
  pinned: PinSide | false;
  highlight: HighlightColor;
}

export interface ColumnDef<T> {
  /** Unique, stable column id. */
  id: string;

  /**
   * Header content. Either a static node or a render function receiving the
   * header context (sort direction/index, pin state, highlight).
   */
  header?: ReactNode | ((ctx: HeaderContext<T>) => ReactNode);

  /** Read the cell value from a row property. */
  accessorKey?: keyof T & string;
  /** Read the cell value with a function. Takes precedence over accessorKey. */
  accessorFn?: (row: T) => unknown;

  /** Custom cell renderer. Defaults to `String(value)`. */
  cell?: (row: T, value: unknown) => ReactNode;

  /* ----- sizing ----- */
  /** Initial width in px (default 160). */
  width?: number;
  /** Minimum width in px (default 64). */
  minWidth?: number;
  /** Maximum width in px (default Infinity). */
  maxWidth?: number;
  /** Absorb leftover horizontal space when the grid is narrower than its container (default true). */
  stretch?: boolean;
  /** Allow drag/keyboard resizing (default true). */
  resizable?: boolean;

  /* ----- pinning ----- */
  /** Initial pin side (uncontrolled). Pinning never moves the column. */
  pin?: PinSide | false;
  /** Show the pin controls (default true). */
  pinnable?: boolean;

  /* ----- ordering ----- */
  /** Allow drag/keyboard reordering of this column (default true). */
  movable?: boolean;

  /* ----- visibility ----- */
  /** Initially hidden (uncontrolled). */
  hidden?: boolean;
  /** Allow hiding this column (default true). */
  hideable?: boolean;

  /* ----- highlight ----- */
  /** Initial highlight colour (uncontrolled). */
  highlight?: HighlightColor;
  /** Allow highlighting from the column menu (default true). */
  highlightable?: boolean;

  /* ----- header menu ----- */
  /** Show the per-column header menu (default true). */
  menu?: boolean;

  /* ----- sorting ----- */
  /** Show the sort header control (default true). */
  sortable?: boolean;
  /** Custom ascending comparator. Defaults to a numeric/date/locale-aware compare of cell values. */
  sortFn?: (a: T, b: T) => number;

  /* ----- search ----- */
  /** Participate in global search (default true). */
  searchable?: boolean;
  /** Text used by search. Defaults to `String(value)`. */
  getSearchText?: (row: T) => string;

  /* ----- grand total ----- */
  /** Aggregation used by the grand-total row. */
  aggregate?: Aggregate<T>;
  /** Render the aggregated value (e.g. currency formatting). */
  renderTotal?: (value: number | null, rows: T[]) => ReactNode;

  /* ----- presentation ----- */
  /**
   * Cell text alignment. When omitted, numeric columns are detected from the
   * data and aligned right.
   */
  align?: Align;
  /** Extra class applied to every body cell of this column. */
  className?: string;
  /** Extra class applied to the header cell. */
  headerClassName?: string;
  /** Accessible label used by header controls when `header` is not a string. */
  label?: string;
}

/* ------------------------------------------------------------------ */
/* Row expansion (sync + async)                                        */
/* ------------------------------------------------------------------ */

export type DetailStatus = "idle" | "loading" | "success" | "error";

export interface AsyncDetailState<D> {
  status: DetailStatus;
  data?: D;
  error?: unknown;
}

export type RowDetailStates<D> = Record<string, AsyncDetailState<D>>;

export interface ExpansionContext<T, D = unknown> {
  row: T;
  rowId: string;
  /** Collapse this row programmatically. */
  collapse: () => void;
  /** Async detail state for this row (`{ status: "idle" }` for sync content). */
  detail: AsyncDetailState<D>;
  /** Re-run the async loader for this row. */
  reload: () => void;
}

export interface DetailLoadingContext<T> {
  row: T;
  rowId: string;
  /** Restart the request (supersedes and aborts the in-flight one). */
  reload: () => void;
  /** Collapse the row. */
  collapse: () => void;
}

export interface DetailErrorContext<T> {
  row: T;
  rowId: string;
  error: unknown;
  reload: () => void;
  /** Collapse the row. */
  collapse: () => void;
}

/* ------------------------------------------------------------------ */
/* Layout persistence                                                  */
/* ------------------------------------------------------------------ */

export const LAYOUT_VERSION = 1;

/** Storage-agnostic, JSON-serializable snapshot of the user's grid layout. */
export interface GridLayoutState {
  version: number;
  columnOrder: ColumnOrderState;
  columnPinning: ColumnPinningState;
  columnWidths: ColumnWidthState;
  columnVisibility: ColumnVisibilityState;
  columnHighlights: ColumnHighlightState;
  sorting: SortState[];
}

export interface DataTableHandle {
  /** Snapshot the current layout (plain object — persist it wherever you like). */
  serializeLayout: () => GridLayoutState;
  /** Restore a snapshot (object or JSON string). Unknown/stale ids are ignored. */
  restoreLayout: (state: GridLayoutState | string) => void;
  /** Reset order/pinning/widths/visibility/highlights (and sorting) to defaults. */
  resetLayout: () => void;
}

/* ------------------------------------------------------------------ */
/* DataTable props                                                     */
/* ------------------------------------------------------------------ */

export interface DataTableProps<T, D = unknown> {
  data: T[];
  columns: ColumnDef<T>[];
  /** Stable unique id per row (required for expansion, keys and a11y). */
  getRowId: (row: T, index: number) => string;

  /* ----- layout / virtualization ----- */
  /** Height of the scroll viewport (default 480). */
  height?: number | string;
  /** Fixed row height in px. Defaults to the density preset. */
  rowHeight?: number;
  /** Row density preset: compact (32) | comfortable (44) | spacious (56). */
  density?: Density;
  /** Extra rows rendered above/below the viewport (default 6). */
  overscan?: number;
  /** Render all rows without windowing. */
  disableVirtualization?: boolean;

  /* ----- loading ----- */
  /** Render skeleton rows matching the column structure. */
  isLoading?: boolean;
  /** Number of skeleton rows (default 8). */
  skeletonRowCount?: number;

  /* ----- expansion (sync) ----- */
  /** Enables the expander column; renders the panel below an expanded row. */
  renderExpandedRow?: (ctx: ExpansionContext<T, D>) => ReactNode;
  /** Per-row opt-out (default: every row expandable when renderExpandedRow is set). */
  getRowCanExpand?: (row: T) => boolean;
  /** Declared height of an expanded panel in px (default 200). */
  expandedRowHeight?: number;
  /** Controlled expansion state. */
  expandedRowIds?: ReadonlySet<string>;
  onExpandedRowIdsChange?: (ids: ReadonlySet<string>) => void;
  /** Fired when a row transitions to expanded (fire-and-forget hook). */
  onRowExpand?: (row: T) => void | Promise<void>;

  /* ----- expansion (async details) ----- */
  /**
   * Async detail loader. When provided the grid manages per-row
   * idle/loading/success/error state, renders loading/error UI and passes
   * `detail` + `reload` to `renderExpandedRow`.
   *
   * `ctx.signal` is aborted when the request is superseded (reload) or the
   * grid unmounts — forward it to `fetch` to cancel stale work.
   */
  loadRowDetails?: (
    row: T,
    rowId: string,
    ctx: { signal?: AbortSignal }
  ) => Promise<D>;
  /** Custom loading UI for an expanded panel. */
  renderDetailLoading?: (ctx: DetailLoadingContext<T>) => ReactNode;
  /** Custom error UI for an expanded panel (receives `reload`). */
  renderDetailError?: (ctx: DetailErrorContext<T>) => ReactNode;
  /** Controlled async detail states (the grid will not fetch in this mode). */
  rowDetailStates?: RowDetailStates<D>;
  onRowDetailStatesChange?: (states: RowDetailStates<D>) => void;
  /** Called by `reload()` in controlled async mode. */
  onRowDetailReload?: (row: T, rowId: string) => void;

  /* ----- sorting ----- */
  /** Controlled single-sort state (`null` = unsorted). */
  sortState?: SortState | null;
  onSortStateChange?: (sort: SortState | null) => void;
  defaultSortState?: SortState | null;
  /** Controlled multi-sort state (takes precedence over `sortState`). */
  sorting?: SortState[];
  onSortingChange?: (sorting: SortState[]) => void;
  defaultSorting?: SortState[];
  /** Enable multi-column sorting (shift+click / menu "add to sort"). */
  multiSort?: boolean;

  /* ----- search ----- */
  /** Show the built-in search toolbar (default false). */
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  defaultSearchValue?: string;

  /* ----- column order ----- */
  /** Controlled column order (ids, including hidden columns). */
  columnOrder?: ColumnOrderState;
  onColumnOrderChange?: (order: ColumnOrderState) => void;
  defaultColumnOrder?: ColumnOrderState;
  /** Enable header drag-and-drop reordering (default true). */
  enableColumnReorder?: boolean;

  /* ----- pinning ----- */
  columnPinning?: ColumnPinningState;
  onColumnPinningChange?: (state: ColumnPinningState) => void;
  defaultColumnPinning?: ColumnPinningState;

  /* ----- widths ----- */
  columnWidths?: ColumnWidthState;
  onColumnWidthsChange?: (widths: ColumnWidthState) => void;
  defaultColumnWidths?: ColumnWidthState;

  /* ----- visibility ----- */
  columnVisibility?: ColumnVisibilityState;
  onColumnVisibilityChange?: (state: ColumnVisibilityState) => void;
  defaultColumnVisibility?: ColumnVisibilityState;
  /** Show the toolbar "Columns" panel (visibility + reset layout). */
  showColumnsPanel?: boolean;

  /* ----- highlight ----- */
  columnHighlights?: ColumnHighlightState;
  onColumnHighlightsChange?: (state: ColumnHighlightState) => void;
  defaultColumnHighlights?: ColumnHighlightState;
  /** Apply column highlight to the grand-total row too (default true). */
  highlightTotals?: boolean;

  /* ----- column menu ----- */
  /** Enable the per-column header menu (default true). */
  enableColumnMenu?: boolean;
  /**
   * Portal target for column menus and the columns panel
   * (default `document.body`). Point this at a themed subtree when your theme
   * variables are declared on a wrapper element rather than `:root`.
   */
  menuPortalContainer?: HTMLElement | null;

  /* ----- layout persistence ----- */
  /** Initial layout snapshot for uncontrolled state (from your storage). */
  defaultLayout?: GridLayoutState | null;
  /** Fired whenever any layout-relevant state changes. */
  onLayoutChange?: (layout: GridLayoutState) => void;

  /* ----- grand total ----- */
  showGrandTotal?: boolean;
  grandTotalLabel?: ReactNode;
  totalsScope?: TotalsScope;

  /* ----- empty states ----- */
  /** Shown when `data` is empty. */
  emptyMessage?: ReactNode;
  /** Shown when search filtered everything out (default "No matching rows"). */
  noResultsMessage?: ReactNode;

  /* ----- misc ----- */
  className?: string;
  /** Toolbar slot rendered before the search input. */
  toolbarStart?: ReactNode;
  /** Toolbar slot rendered after the search input. */
  toolbarEnd?: ReactNode;
  /** @deprecated use `toolbarEnd`. */
  toolbarContent?: ReactNode;
  onRowClick?: (row: T) => void;
  ariaLabel?: string;
}

/* ------------------------------------------------------------------ */
/* TableSkeleton props                                                 */
/* ------------------------------------------------------------------ */

export interface TableSkeletonProps {
    /** Number of skeleton body rows (default 8). */
    rows?: number;
    /** Number of skeleton columns (default 5). */
    columns?: number;
    /** Row height in px (default 44). */
    rowHeight?: number;
    height?: number | string;
    className?: string;
    density?: Density;
}