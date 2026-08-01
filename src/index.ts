export { DataTable } from "./DataTable";
export { TreeDataTable } from "./TreeDataTable";
export { TableSkeleton } from "./components/TableSkeleton";
export { InfoTooltip, type InfoTooltipProps } from "./components/InfoTooltip";

/* tree table types */
export type {
  ChildrenErrorContext,
  ChildrenLoadingContext,
  RowChildrenStates,
  TreeColumnDef,
  TreeDataTableProps,
} from "./treeTypes";

/* layout persistence helpers (storage-agnostic) */
export {
  serializeLayout,
  parseLayout,
  reconcileLayout,
  createEmptyLayout,
} from "./utils/persistence";

/* finance formatter helpers */
export {
  formatCurrency,
  createCurrencyFormatter,
  formatPercent,
  formatNumber,
  formatVariance,
  type CurrencyOptions,
} from "./utils/format";

/* sorting helpers (useful for controlled sorting) */
export {
  cycleSingleSort,
  cycleMultiSort,
  addSort,
  removeSort,
  setSingleSort,
  makeSortComparator,
} from "./utils/sorting";

export { LAYOUT_VERSION } from "./types";

export type {
  Aggregate,
  AggregateFn,
  Align,
  AsyncDetailState,
  ColumnDef,
  ColumnHighlightState,
  ColumnOrderState,
  ColumnPinningState,
  ColumnVisibilityState,
  ColumnWidthState,
  DataTableHandle,
  DataTableProps,
  Density,
  DetailErrorContext,
  DetailLoadingContext,
  DetailStatus,
  ExpansionContext,
  GridLayoutState,
  HeaderContext,
  HighlightColor,
  PinSide,
  RowDetailStates,
  SortDirection,
  SortState,
  TableSkeletonProps,
  TotalsScope,
} from "./types";