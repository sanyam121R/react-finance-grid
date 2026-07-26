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

/** Ids listed in order; order inside each array is the pinned order. */
export interface ColumnPinningState {
    left: string[];
    right: string[];
}

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
    pinned: PinSide | false;
}

export interface ColumnDef<T> {
    /** Unique, stable column id. */
    id: string;

    /**
     * Header content. Either a static node or a render function receiving the
     * header context (current sort direction, pin state).
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
    /** Initial pin side (uncontrolled mode). Also the side the header pin button targets. */
    pin?: PinSide | false;
    /** Show the pin/unpin header control (default true). */
    pinnable?: boolean;

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
    /** Cell text alignment (default "left"). */
    align?: Align;
    /** Extra class applied to every body cell of this column. */
    className?: string;
    /** Extra class applied to the header cell. */
    headerClassName?: string;
}

/* ------------------------------------------------------------------ */
/* Expansion                                                           */
/* ------------------------------------------------------------------ */

export interface ExpansionContext<T> {
    row: T;
    rowId: string;
    /** Collapse this row programmatically. */
    collapse: () => void;
}

/* ------------------------------------------------------------------ */
/* DataTable props                                                     */
/* ------------------------------------------------------------------ */

export interface DataTableProps<T> {
    data: T[];
    columns: ColumnDef<T>[];
    /** Stable unique id per row (required for expansion, keys and a11y). */
    getRowId: (row: T, index: number) => string;

    /* ----- layout / virtualization ----- */
    /** Height of the scroll viewport (default 480). */
    height?: number | string;
    /** Fixed row height in px; the windowing contract (default 44). */
    rowHeight?: number;
    /** Extra rows rendered above/below the viewport (default 6). */
    overscan?: number;
    /** Render all rows without windowing. */
    disableVirtualization?: boolean;

    /* ----- loading ----- */
    /** Render skeleton rows matching the column structure. */
    isLoading?: boolean;
    /** Number of skeleton rows (default 8). */
    skeletonRowCount?: number;

    /* ----- expansion ----- */
    /** Enables the expander column; renders the panel below an expanded row. */
    renderExpandedRow?: (ctx: ExpansionContext<T>) => ReactNode;
    /** Per-row opt-out (default: every row expandable when renderExpandedRow is set). */
    getRowCanExpand?: (row: T) => boolean;
    /** Declared height of an expanded panel in px (default 200). */
    expandedRowHeight?: number;
    /** Controlled expansion state. */
    expandedRowIds?: ReadonlySet<string>;
    onExpandedRowIdsChange?: (ids: ReadonlySet<string>) => void;
    /**
     * Extension point for future async detail loading: invoked when a row
     * transitions to expanded. May return a Promise; the grid ignores the
     * result today but the signature is stable.
     */
    onRowExpand?: (row: T) => void | Promise<void>;

    /* ----- sorting ----- */
    /** Controlled sort state (`null` = unsorted). */
    sortState?: SortState | null;
    onSortStateChange?: (sort: SortState | null) => void;
    /** Initial sort for uncontrolled mode. */
    defaultSortState?: SortState | null;

    /* ----- search ----- */
    /** Show the built-in search toolbar (default false). */
    showSearch?: boolean;
    searchPlaceholder?: string;
    /** Controlled search value. */
    searchValue?: string;
    onSearchValueChange?: (value: string) => void;
    defaultSearchValue?: string;

    /* ----- pinning ----- */
    /** Controlled pinning state. Uncontrolled initial state derives from `column.pin`. */
    columnPinning?: ColumnPinningState;
    onColumnPinningChange?: (state: ColumnPinningState) => void;

    /* ----- grand total ----- */
    /** Show the sticky grand-total row (uses `column.aggregate`). */
    showGrandTotal?: boolean;
    /** Label placed in the first column without an aggregate (default "Grand total"). */
    grandTotalLabel?: ReactNode;
    /** Compute totals over "filtered" (default) or "all" rows. */
    totalsScope?: TotalsScope;

    /* ----- misc ----- */
    emptyMessage?: ReactNode;
    className?: string;
    /** Extra toolbar content (filters, actions…) rendered next to search. */
    toolbarContent?: ReactNode;
    onRowClick?: (row: T) => void;
    /** Accessible label for the grid (default "Data table"). */
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
}