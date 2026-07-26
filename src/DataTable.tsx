import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type Ref,
  type UIEvent,
} from "react";
import {
  LAYOUT_VERSION,
  type Align,
  type DataTableHandle,
  type DataTableProps,
  type GridLayoutState,
  type HighlightColor,
  type PinSide,
  type SortDirection,
  type SortState,
} from "./types";
import { useControllableState } from "./hooks/useControllableState";
import { useIsomorphicLayoutEffect } from "./hooks/useIsomorphicLayoutEffect";
import { useGridLayoutState } from "./hooks/useGridLayoutState";
import { useColumnLayout, type ResolvedColumn } from "./hooks/useColumnLayout";
import { useVirtualRows } from "./hooks/useVirtualRows";
import { useRowDetails } from "./hooks/useRowDetails";
import {
  HeaderCell,
  cellLayoutClass,
  cellLayoutStyle,
  type HeaderCellActions,
} from "./components/HeaderCell";
import { SkeletonRows } from "./components/TableSkeleton";
import { ColumnsPanel } from "./components/ColumnsPanel";
import { DetailError, DetailLoading } from "./components/DetailState";
import { ChevronIcon, SearchIcon } from "./components/icons";
import { getCellValue, getSearchText } from "./utils/accessors";
import { aggregateRows, formatNumber as formatTotalNumber } from "./utils/aggregate";
import { buildAlignMap } from "./utils/align";
import {
  addSort,
  cycleMultiSort,
  cycleSingleSort,
  makeSortComparator,
  removeSort,
  setSingleSort,
} from "./utils/sorting";
import { parseLayout } from "./utils/persistence";
import { DENSITY_ROW_HEIGHT, EXPANDER_WIDTH } from "./utils/layout";
import { clsx } from "./utils/clsx";

type Item<T> =
  | { kind: "row"; row: T; id: string; dataIndex: number }
  | { kind: "detail"; row: T; id: string; dataIndex: number };

function DataTableInner<T, D>(
  props: DataTableProps<T, D>,
  ref: ForwardedRef<DataTableHandle>
) {
  const {
    data,
    columns,
    getRowId,
    height = 480,
    density = "comfortable",
    overscan = 6,
    disableVirtualization = false,
    isLoading = false,
    skeletonRowCount = 8,
    renderExpandedRow,
    getRowCanExpand,
    expandedRowHeight = 200,
    loadRowDetails,
    renderDetailLoading,
    renderDetailError,
    showSearch = false,
    searchPlaceholder = "Search…",
    showGrandTotal = false,
    grandTotalLabel = "Grand total",
    totalsScope = "filtered",
    emptyMessage = "No results",
    noResultsMessage = "No matching rows",
    className,
    toolbarStart,
    toolbarEnd,
    toolbarContent,
    onRowClick,
    onRowExpand,
    ariaLabel = "Data table",
    enableColumnReorder = true,
    enableColumnMenu = true,
    showColumnsPanel = false,
    multiSort = false,
    highlightTotals = true,
    onLayoutChange,
  } = props;

  const rowHeight = props.rowHeight ?? DENSITY_ROW_HEIGHT[density];
  const hasExpander = Boolean(renderExpandedRow);

  /* ---------------- viewport measurements (SSR-safe) ---------------- */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number>(
    typeof height === "number" ? height : 480
  );
  const [scrollTop, setScrollTop] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      setContainerWidth(el.clientWidth);
      if (el.clientHeight > 0) setViewportHeight(el.clientHeight);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  /* ---------------- layout state: order/pin/width/visibility/highlight ---- */
  const layoutState = useGridLayoutState<T>({
    columns,
    defaultLayout: props.defaultLayout,
    columnOrder: props.columnOrder,
    onColumnOrderChange: props.onColumnOrderChange,
    defaultColumnOrder: props.defaultColumnOrder,
    columnPinning: props.columnPinning,
    onColumnPinningChange: props.onColumnPinningChange,
    defaultColumnPinning: props.defaultColumnPinning,
    columnWidths: props.columnWidths,
    onColumnWidthsChange: props.onColumnWidthsChange,
    defaultColumnWidths: props.defaultColumnWidths,
    columnVisibility: props.columnVisibility,
    onColumnVisibilityChange: props.onColumnVisibilityChange,
    defaultColumnVisibility: props.defaultColumnVisibility,
    columnHighlights: props.columnHighlights,
    onColumnHighlightsChange: props.onColumnHighlightsChange,
    defaultColumnHighlights: props.defaultColumnHighlights,
  });

  const { columns: cols, totalWidth, startResizeDrag, nudgeColumnWidth } =
    useColumnLayout<T>({
      columns: layoutState.orderedVisibleColumns,
      widths: layoutState.widths,
      pinOf: layoutState.pinOf,
      containerWidth,
      hasExpander,
      setColumnWidth: layoutState.setColumnWidth,
    });

  /* ---------------- alignment defaults (numeric -> right) ---------------- */
  const alignMap = useMemo(() => buildAlignMap(columns, data), [columns, data]);
  const alignOf = useCallback(
    (columnId: string): Align => alignMap[columnId] ?? "left",
    [alignMap]
  );

  /* ---------------- search ---------------- */
  const [search, setSearch] = useControllableState<string>(
    props.searchValue,
    props.onSearchValueChange,
    props.defaultSearchValue ?? ""
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    const searchCols = columns.filter((c) => c.searchable !== false);
    if (searchCols.length === 0) return data;
    return data.filter((row) =>
      searchCols.some((c) => getSearchText(c, row).toLowerCase().includes(q))
    );
  }, [data, columns, search]);

  /* ---------------- sorting (single + multi) ---------------- */
  const controlledSorting = useMemo<SortState[] | undefined>(() => {
    if (props.sorting !== undefined) return props.sorting;
    if (props.sortState !== undefined) {
      return props.sortState ? [props.sortState] : [];
    }
    return undefined;
  }, [props.sorting, props.sortState]);

  const [sortingState, setSortingState] = useControllableState<SortState[]>(
    controlledSorting,
    undefined,
    () => {
      const fromLayout = props.defaultLayout
        ? parseLayout(props.defaultLayout)?.sorting
        : undefined;
      return (
        fromLayout ??
        props.defaultSorting ??
        (props.defaultSortState ? [props.defaultSortState] : [])
      );
    }
  );

  const onSortingChangeRef = useRef(props.onSortingChange);
  onSortingChangeRef.current = props.onSortingChange;
  const onSortStateChangeRef = useRef(props.onSortStateChange);
  onSortStateChangeRef.current = props.onSortStateChange;

  const setSorting = useCallback(
    (next: SortState[]) => {
      setSortingState(next);
      onSortingChangeRef.current?.(next);
      onSortStateChangeRef.current?.(next[0] ?? null);
    },
    [setSortingState]
  );

  const sorting = sortingState;

  const sortInfo = useCallback(
    (columnId: string): { direction: SortDirection | null; index: number | null } => {
      const i = sorting.findIndex((s) => s.columnId === columnId);
      if (i === -1) return { direction: null, index: null };
      return { direction: sorting[i]!.direction, index: i + 1 };
    },
    [sorting]
  );

  const sorted = useMemo(() => {
    const cmp = makeSortComparator(sorting, columns);
    if (!cmp) return filtered;
    return [...filtered].sort(cmp);
  }, [filtered, sorting, columns]);

  /* ---------------- expansion + async details ---------------- */
  const [expandedIds, setExpandedIds] = useControllableState<ReadonlySet<string>>(
    props.expandedRowIds,
    props.onExpandedRowIdsChange,
    () => new Set<string>()
  );

  const details = useRowDetails<T, D>({
    loadRowDetails,
    rowDetailStates: props.rowDetailStates,
    onRowDetailStatesChange: props.onRowDetailStatesChange,
    onRowDetailReload: props.onRowDetailReload,
  });

  const collapseRow = useCallback(
    (rowId: string) => {
      const next = new Set(expandedIds);
      next.delete(rowId);
      setExpandedIds(next);
    },
    [expandedIds, setExpandedIds]
  );

  const toggleExpanded = useCallback(
    (row: T, rowId: string) => {
      const next = new Set(expandedIds);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
        void onRowExpand?.(row);
        details.ensureLoaded(row, rowId);
      }
      setExpandedIds(next);
    },
    [expandedIds, setExpandedIds, onRowExpand, details]
  );

  /* ---------------- flatten rows + expanded panels ---------------- */
  const items = useMemo<Item<T>[]>(() => {
    const out: Item<T>[] = [];
    sorted.forEach((row, i) => {
      const id = getRowId(row, i);
      out.push({ kind: "row", row, id, dataIndex: i });
      if (hasExpander && expandedIds.has(id)) {
        out.push({ kind: "detail", row, id, dataIndex: i });
      }
    });
    return out;
  }, [sorted, getRowId, hasExpander, expandedIds]);

  const heights = useMemo(
    () => items.map((it) => (it.kind === "row" ? rowHeight : expandedRowHeight)),
    [items, rowHeight, expandedRowHeight]
  );

  /* ---------------- windowing ---------------- */
  const headerHeight = rowHeight;
  const totalRowHeight = showGrandTotal ? rowHeight : 0;
  const { items: virtualItems, totalHeight } = useVirtualRows({
    heights,
    scrollTop,
    viewportHeight: Math.max(0, viewportHeight - headerHeight - totalRowHeight),
    overscan,
    disabled: disableVirtualization,
  });

  /* ---------------- grand total ---------------- */
  const totalsRows = totalsScope === "all" ? data : filtered;
  const totals = useMemo(() => {
    if (!showGrandTotal) return null;
    return cols.map((col) => aggregateRows(col.def, totalsRows));
  }, [showGrandTotal, cols, totalsRows]);

  const labelColumnIndex = useMemo(
    () => cols.findIndex((c) => !c.def.aggregate),
    [cols]
  );

  /* ---------------- drag reorder ---------------- */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);

  const headerActions = useMemo<HeaderCellActions>(
    () => ({
      toggleSort: (columnId, additive) =>
        setSorting(
          additive
            ? cycleMultiSort(sorting, columnId)
            : cycleSingleSort(sorting, columnId)
        ),
      setSort: (columnId, direction, additive) =>
        setSorting(
          additive
            ? addSort(sorting, columnId, direction)
            : setSingleSort(columnId, direction)
        ),
      clearSort: (columnId) => setSorting(removeSort(sorting, columnId)),
      setPin: (columnId, side: PinSide | false) =>
        layoutState.setPin(columnId, side),
      togglePin: (columnId) => layoutState.togglePin(columnId),
      moveColumn: (columnId, direction) =>
        layoutState.moveColumn(columnId, direction),
      hideColumn: (columnId) => layoutState.setVisibility(columnId, false),
      resetWidth: (columnId) => layoutState.resetColumnWidth(columnId),
      setHighlight: (columnId, color: HighlightColor) =>
        layoutState.setHighlight(columnId, color),
      resizeDragStart: startResizeDrag,
      resizeNudge: nudgeColumnWidth,
      dragStart: (columnId) => {
        draggingRef.current = columnId;
        setDraggingId(columnId);
      },
      dragOver: (columnId) => {
        if (!draggingRef.current || draggingRef.current === columnId) return;
        setDropTargetId(columnId);
      },
      drop: (columnId) => {
        const dragId = draggingRef.current;
        draggingRef.current = null;
        setDraggingId(null);
        setDropTargetId(null);
        if (dragId && dragId !== columnId) {
          layoutState.reorderColumn(dragId, columnId);
        }
      },
      dragEnd: () => {
        draggingRef.current = null;
        setDraggingId(null);
        setDropTargetId(null);
      },
    }),
    [sorting, setSorting, layoutState, startResizeDrag, nudgeColumnWidth]
  );

  /* ---------------- layout snapshot / restore / reset ---------------- */
  const getLayout = useCallback(
    (): GridLayoutState => ({
      version: LAYOUT_VERSION,
      ...layoutState.snapshot(),
      sorting,
    }),
    [layoutState, sorting]
  );

  const restoreLayout = useCallback(
    (input: GridLayoutState | string) => {
      const parsed = parseLayout(input);
      if (!parsed) return;
      layoutState.restore(parsed);
      setSorting(parsed.sorting);
    },
    [layoutState, setSorting]
  );

  const resetLayout = useCallback(() => {
    layoutState.reset();
    setSorting([]);
  }, [layoutState, setSorting]);

  useImperativeHandle(
    ref,
    () => ({
      serializeLayout: getLayout,
      restoreLayout,
      resetLayout,
    }),
    [getLayout, restoreLayout, resetLayout]
  );

  /* notify consumers about layout changes (skip the initial render) */
  const lastLayoutRef = useRef<string | null>(null);
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;
  useEffect(() => {
    const layout = getLayout();
    const serialized = JSON.stringify(layout);
    if (lastLayoutRef.current === null) {
      lastLayoutRef.current = serialized;
      return;
    }
    if (lastLayoutRef.current !== serialized) {
      lastLayoutRef.current = serialized;
      onLayoutChangeRef.current?.(layout);
    }
  }, [getLayout]);

  /* ---------------- renderers ---------------- */
  const rowWidth = Math.max(totalWidth, containerWidth);

  const renderDataCell = (col: ResolvedColumn<T>, row: T): ReactNode => {
    const { def } = col;
    const value = getCellValue(def, row);
    const content = def.cell
      ? def.cell(row, value)
      : value === null || value === undefined
        ? ""
        : String(value);
    const align = alignOf(def.id);
    const highlight = layoutState.highlightOf(def.id);
    return (
      <div
        key={def.id}
        role="cell"
        data-column-id={def.id}
        data-highlight={highlight === "none" ? undefined : highlight}
        className={clsx(
          "rfg-cell",
          cellLayoutClass(col, highlight),
          align === "right" && "rfg-cell--right",
          align === "center" && "rfg-cell--center",
          def.className
        )}
        style={cellLayoutStyle(col)}
      >
        <span className="rfg-cell-content">{content}</span>
      </div>
    );
  };

  const renderExpanderCell = (row: T | null, rowId?: string): ReactNode => {
    const canExpand = row
      ? getRowCanExpand
        ? getRowCanExpand(row)
        : true
      : false;
    const isOpen = rowId ? expandedIds.has(rowId) : false;
    return (
      <div
        role={row ? "cell" : "columnheader"}
        className="rfg-cell rfg-cell--pin-left rfg-expander-cell"
        style={{ width: EXPANDER_WIDTH, minWidth: EXPANDER_WIDTH, left: 0 }}
      >
        {row && canExpand && rowId !== undefined && (
          <button
            type="button"
            className={clsx("rfg-icon-btn rfg-expander", isOpen && "rfg-expander--open")}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Collapse row" : "Expand row"}
            data-testid={`expand-${rowId}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(row, rowId);
            }}
          >
            <ChevronIcon />
          </button>
        )}
      </div>
    );
  };

  const renderDetailBody = (row: T, rowId: string): ReactNode => {
    const state = details.getState(rowId);
    const reload = () => details.reload(row, rowId);

    if (details.isAsync) {
      if (state.status === "idle" || state.status === "loading") {
        return (
          renderDetailLoading?.({ row, rowId }) ?? <DetailLoading rowId={rowId} />
        );
      }
      if (state.status === "error") {
        return (
          renderDetailError?.({ row, rowId, error: state.error, reload }) ?? (
            <DetailError rowId={rowId} error={state.error} onRetry={reload} />
          )
        );
      }
    }
    return renderExpandedRow?.({
      row,
      rowId,
      collapse: () => collapseRow(rowId),
      detail: state,
      reload,
    });
  };

  const isEmptyData = data.length === 0;
  const hasNoResults = !isEmptyData && sorted.length === 0;

  /* ---------------- render ---------------- */
  const showToolbar =
    showSearch || showColumnsPanel || toolbarStart || toolbarEnd || toolbarContent;

  return (
    <div className={clsx("rfg-root", `rfg-root--${density}`, className)}>
      {showToolbar && (
        <div className="rfg-toolbar">
          {toolbarStart}
          {showSearch && (
            <div className="rfg-search">
              <SearchIcon />
              <input
                type="search"
                value={search}
                placeholder={searchPlaceholder}
                aria-label="Search table"
                data-testid="rfg-search"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          {showColumnsPanel && (
            <ColumnsPanel<T>
              columns={layoutState.orderedColumns}
              isVisible={layoutState.isVisible}
              onToggle={layoutState.toggleVisibility}
              onShowAll={layoutState.showAllColumns}
              onResetLayout={resetLayout}
            />
          )}
          <span className="rfg-toolbar-spacer" />
          {toolbarEnd}
          {toolbarContent}
        </div>
      )}

      <div
        ref={scrollRef}
        className="rfg-scroll"
        style={{ height }}
        onScroll={onScroll}
        role="table"
        aria-label={ariaLabel}
        aria-rowcount={sorted.length + 1 + (showGrandTotal ? 1 : 0)}
        aria-colcount={cols.length + (hasExpander ? 1 : 0)}
        aria-busy={isLoading}
        data-testid="rfg-scroll"
      >
        {/* header — sticky top */}
        <div
          className="rfg-header"
          role="row"
          aria-rowindex={1}
          style={{ height: headerHeight, width: rowWidth }}
        >
          {hasExpander && renderExpanderCell(null)}
          {cols.map((col) => {
            const info = sortInfo(col.id);
            return (
              <HeaderCell<T>
                key={col.id}
                col={col}
                align={alignOf(col.id)}
                sortDirection={info.direction}
                sortIndex={info.index}
                sortCount={sorting.length}
                highlight={layoutState.highlightOf(col.id)}
                hasWidthOverride={layoutState.widths[col.id] !== undefined}
                canMoveLeft={layoutState.canMove(col.id, -1)}
                canMoveRight={layoutState.canMove(col.id, 1)}
                enableMenu={enableColumnMenu}
                enableReorder={enableColumnReorder}
                multiSort={multiSort}
                isDragging={draggingId === col.id}
                isDropTarget={dropTargetId === col.id}
                actions={headerActions}
              />
            );
          })}
        </div>

        {/* body */}
        {isLoading ? (
          <SkeletonRows
            columns={cols}
            rowCount={skeletonRowCount}
            rowHeight={rowHeight}
            totalWidth={rowWidth}
            hasExpander={hasExpander}
          />
        ) : items.length === 0 ? (
          <div
            className="rfg-empty"
            role="row"
            data-testid={hasNoResults ? "rfg-no-results" : "rfg-empty"}
          >
            <div role="cell">{hasNoResults ? noResultsMessage : emptyMessage}</div>
          </div>
        ) : (
          <div
            className="rfg-body"
            role="rowgroup"
            style={{ height: totalHeight, width: rowWidth }}
          >
            {virtualItems.map((vi) => {
              const item = items[vi.index];
              if (!item) return null;

              if (item.kind === "detail") {
                return (
                  <div
                    key={`${item.id}::detail`}
                    className="rfg-detail-row"
                    data-testid={`detail-${item.id}`}
                    style={{
                      transform: `translateY(${vi.start}px)`,
                      height: vi.height,
                      width: rowWidth,
                    }}
                  >
                    <div
                      className="rfg-detail-content"
                      style={{ width: containerWidth || "100%" }}
                    >
                      {renderDetailBody(item.row, item.id)}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  role="row"
                  aria-rowindex={item.dataIndex + 2}
                  className={clsx("rfg-row", onRowClick && "rfg-row--clickable")}
                  style={{
                    transform: `translateY(${vi.start}px)`,
                    height: vi.height,
                    width: rowWidth,
                  }}
                  onClick={onRowClick ? () => onRowClick(item.row) : undefined}
                >
                  {hasExpander && renderExpanderCell(item.row, item.id)}
                  {cols.map((col) => renderDataCell(col, item.row))}
                </div>
              );
            })}
          </div>
        )}

        {/* grand total — sticky bottom */}
        {showGrandTotal && !isLoading && totals && (
          <div
            className="rfg-total-row"
            role="row"
            data-testid="rfg-grand-total"
            style={{ height: rowHeight, width: rowWidth }}
          >
            {hasExpander && (
              <div
                role="cell"
                className="rfg-cell rfg-cell--pin-left rfg-expander-cell"
                style={{ width: EXPANDER_WIDTH, minWidth: EXPANDER_WIDTH, left: 0 }}
              />
            )}
            {cols.map((col, i) => {
              let content: ReactNode = null;
              if (col.def.aggregate) {
                const value = totals[i] ?? null;
                content = col.def.renderTotal
                  ? col.def.renderTotal(value, totalsRows)
                  : value !== null
                    ? formatTotalNumber(value)
                    : "—";
              } else if (i === labelColumnIndex) {
                content = grandTotalLabel;
              }
              const align = alignOf(col.id);
              const highlight = highlightTotals
                ? layoutState.highlightOf(col.id)
                : "none";
              return (
                <div
                  key={col.id}
                  role="cell"
                  data-column-id={col.id}
                  data-highlight={highlight === "none" ? undefined : highlight}
                  className={clsx(
                    "rfg-cell",
                    cellLayoutClass(col, highlight),
                    align === "right" && "rfg-cell--right",
                    align === "center" && "rfg-cell--center"
                  )}
                  style={cellLayoutStyle(col)}
                >
                  <span className="rfg-cell-content rfg-total-content">{content}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Financial-grade data table: virtualized rows, in-place pinned columns,
 * drag reorder, per-column menu, highlighting, sync/async expandable rows,
 * sticky grand totals, sorting (single/multi), search, column visibility,
 * resizable columns and layout persistence.
 */
export const DataTable = forwardRef(DataTableInner) as <T, D = unknown>(
  props: DataTableProps<T, D> & { ref?: Ref<DataTableHandle> }
) => ReactElement;