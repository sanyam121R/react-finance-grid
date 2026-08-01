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
    type GridLayoutState,
    type HighlightColor,
    type PinSide,
    type SortDirection,
    type SortState,
  } from "./types";
  import type {
    TreeColumnDef,
    TreeDataTableProps,
  } from "./treeTypes";
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
  import { InfoTooltip } from "./components/InfoTooltip";
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
  import {
    flattenTree,
    type ChildrenSource,
    type FlatTreeItem,
    type FlatTreeRow,
  } from "./utils/tree";
  import { parseLayout } from "./utils/persistence";
  import { DENSITY_ROW_HEIGHT } from "./utils/layout";
  import { clsx } from "./utils/clsx";
  
  const DEFAULT_INDENT = 24;
  
  function TreeDataTableInner<T>(
    props: TreeDataTableProps<T>,
    ref: ForwardedRef<DataTableHandle>
  ) {
    const {
      data,
      columns,
      getRowId,
      getRowChildren,
      loadRowChildren,
      getRowCanExpand,
      renderChildrenLoading,
      renderChildrenError,
      onRowExpand,
      treeColumnId,
      indentSize = DEFAULT_INDENT,
      height = 480,
      density = "comfortable",
      overscan = 6,
      disableVirtualization = false,
      isLoading = false,
      skeletonRowCount = 8,
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
      onRowClick,
      ariaLabel = "Data table",
      enableColumnReorder = true,
      enableColumnMenu = true,
      showColumnsPanel = false,
      multiSort = false,
      highlightTotals = true,
      onLayoutChange,
      menuPortalContainer,
    } = props;
  
    const rowHeight = props.rowHeight ?? DENSITY_ROW_HEIGHT[density];
    /** Sync children take precedence over the async loader. */
    const syncChildren = Boolean(getRowChildren);
  
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
  
    /* scroll updates coalesced to one state update per animation frame */
    const scrollRafRef = useRef<number | null>(null);
    const pendingScrollRef = useRef(0);
    const onScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
      const top = e.currentTarget.scrollTop;
      pendingScrollRef.current = top;
      if (
        typeof window === "undefined" ||
        typeof window.requestAnimationFrame !== "function"
      ) {
        setScrollTop(top);
        return;
      }
      if (scrollRafRef.current !== null) return;
      setScrollTop(top);
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        setScrollTop(pendingScrollRef.current);
      });
    }, []);
  
    useEffect(
      () => () => {
        if (scrollRafRef.current !== null && typeof window !== "undefined") {
          window.cancelAnimationFrame(scrollRafRef.current);
        }
      },
      []
    );
  
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
        hasExpander: false,
        setColumnWidth: layoutState.setColumnWidth,
      });
  
    /** Column carrying indentation + the expand chevron. */
    const resolvedTreeColumnId = treeColumnId ?? columns[0]?.id;
  
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
  
    const matches = useMemo<((row: T) => boolean) | null>(() => {
      const q = search.trim().toLowerCase();
      if (!q) return null;
      const searchCols = columns.filter((c) => c.searchable !== false);
      if (searchCols.length === 0) return null;
      return (row: T) =>
        searchCols.some((c) => getSearchText(c, row).toLowerCase().includes(q));
    }, [columns, search]);
  
    /* ---------------- sorting (single + multi) ---------------- */
    const [sortingState, setSortingState] = useControllableState<SortState[]>(
      props.sorting,
      undefined,
      () => {
        const fromLayout = props.defaultLayout
          ? parseLayout(props.defaultLayout)?.sorting
          : undefined;
        return fromLayout ?? props.defaultSorting ?? [];
      }
    );
    const onSortingChangeRef = useRef(props.onSortingChange);
    onSortingChangeRef.current = props.onSortingChange;
    const setSorting = useCallback(
      (next: SortState[]) => {
        setSortingState(next);
        onSortingChangeRef.current?.(next);
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
  
    /** Applied independently to every sibling group — children stay glued
        under their parent in both sort directions. */
    const comparator = useMemo(
      () => makeSortComparator(sorting, columns),
      [sorting, columns]
    );
  
    /* ---------------- expansion + async children ---------------- */
    const [expandedIds, setExpandedIds] = useControllableState<ReadonlySet<string>>(
      props.expandedRowIds,
      props.onExpandedRowIdsChange,
      () => props.defaultExpandedRowIds ?? new Set<string>()
    );
  
    const details = useRowDetails<T, T[]>({
      loadRowDetails: syncChildren ? undefined : loadRowChildren,
      rowDetailStates: props.rowChildrenStates,
      onRowDetailStatesChange: props.onRowChildrenStatesChange,
      onRowDetailReload: props.onRowChildrenReload,
    });
    const asyncChildren = !syncChildren && details.isAsync;
    // `details` is a fresh object every render — depend on its stable members
    // only, or the flatten memo below re-runs on every render/scroll frame.
    // const getChildrenState = details.getState;
    // const ensureChildrenLoaded = details.ensureLoaded;
    const reloadChildren = details.reload;
    
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
          if (asyncChildren) details.ensureLoaded(row, rowId);
        }
        setExpandedIds(next);
      },
      [expandedIds, setExpandedIds, onRowExpand, asyncChildren, details]
    );
  
    /* ---------------- flatten: sort per level, filter, window ---------------- */
    const childrenSource = useCallback(
      (row: T, rowId: string): ChildrenSource<T> => {
        if (syncChildren) {
          const children = getRowChildren!(row) ?? [];
          return { mode: "sync", children };
        }
        if (asyncChildren) {
          const state = details.getState(rowId);
          return {
            mode: "async",
            status: state.status,
            children: state.data,
            error: state.error,
          };
        }
        return { mode: "none" };
      },
      [syncChildren, getRowChildren, asyncChildren, details]
    );
  
    const isExpanded = useCallback(
      (rowId: string) => expandedIds.has(rowId),
      [expandedIds]
    );
  
    const { items, rootRows } = useMemo(
      () =>
        flattenTree<T>({
          roots: data,
          getRowId,
          getChildren: childrenSource,
          getRowCanExpand,
          isExpanded,
          comparator,
          matches,
        }),
      [data, getRowId, childrenSource, getRowCanExpand, isExpanded, comparator, matches]
    );
  
    /* ---------------- windowing (uniform row heights) ---------------- */
    const heights = useMemo(
      () => items.map(() => rowHeight),
      [items, rowHeight]
    );
    const headerHeight = rowHeight;
    const totalRowHeight = showGrandTotal ? rowHeight : 0;
    const { items: virtualItems, totalHeight } = useVirtualRows({
      heights,
      scrollTop,
      viewportHeight: Math.max(0, viewportHeight - headerHeight - totalRowHeight),
      overscan,
      disabled: disableVirtualization,
    });
  
    /* ---------------- grand total — ROOT rows only ---------------- */
    const totalsRows = totalsScope === "all" ? data : rootRows;
    const totals = useMemo(() => {
      if (!showGrandTotal) return null;
      return cols.map((col) => aggregateRows(col.def, totalsRows));
    }, [showGrandTotal, cols, totalsRows]);
  
    const labelColumnIndex = useMemo(
      () => cols.findIndex((c) => !c.def.aggregate),
      [cols]
    );
  
    /* ---------------- drag reorder ---------------- */
    const columnsById = useMemo(
      () => new Map(columns.map((c) => [c.id, c])),
      [columns]
    );
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
        hideColumn: (columnId) => {
          layoutState.setVisibility(columnId, false);
          scrollRef.current?.focus?.();
        },
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
          if (columnsById.get(columnId)?.movable === false) return;
          setDropTargetId(columnId);
        },
        drop: (columnId, fallbackDragId) => {
          const dragId = draggingRef.current ?? fallbackDragId ?? null;
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
      [sorting, setSorting, layoutState, startResizeDrag, nudgeColumnWidth, columnsById]
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
  
    const renderDataCell = (
      col: ResolvedColumn<T>,
      item: FlatTreeRow<T>
    ): ReactNode => {
      const def = col.def as TreeColumnDef<T>;
      const { row, id: rowId } = item;
      const value = getCellValue(def, row);
      const content = def.cell
        ? def.cell(row, value)
        : value === null || value === undefined
          ? ""
          : String(value);
      const align = alignOf(def.id);
      const highlight = layoutState.highlightOf(def.id);
      const isTreeCell = def.id === resolvedTreeColumnId;
      const info = def.infoTip ? def.infoTip(row, rowId) : null;
      const headerLabel =
        def.label ?? (typeof def.header === "string" ? def.header : def.id);
  
      return (
        <div
          key={def.id}
          role="gridcell"
          data-column-id={def.id}
          data-highlight={highlight === "none" ? undefined : highlight}
          className={clsx(
            "rfg-cell",
            cellLayoutClass(col, highlight),
            align === "right" && "rfg-cell--right",
            align === "center" && "rfg-cell--center",
            isTreeCell && "rfg-tree-cell",
            def.className
          )}
          style={cellLayoutStyle(col)}
        >
          {isTreeCell && (
            <>
              {item.depth > 0 && (
                <span
                  className="rfg-tree-indent"
                  aria-hidden="true"
                  style={{ width: item.depth * indentSize }}
                />
              )}
              {item.canExpand ? (
                <button
                  type="button"
                  className={clsx(
                    "rfg-icon-btn rfg-tree-toggle",
                    item.expanded && "rfg-tree-toggle--open"
                  )}
                  aria-expanded={item.expanded}
                  aria-label={item.expanded ? "Collapse row" : "Expand row"}
                  data-testid={`tree-expand-${rowId}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(row, rowId);
                  }}
                >
                  <ChevronIcon />
                </button>
              ) : (
                <span className="rfg-tree-toggle-spacer" aria-hidden="true" />
              )}
            </>
          )}
          <span className="rfg-cell-content">{content}</span>
          {info !== null && info !== undefined && (
            <InfoTooltip
              content={info}
              label={def.infoTipLabel ?? `Details: ${headerLabel}`}
              portalContainer={menuPortalContainer}
              portalClassName={className}
              testId={`info-${def.id}-${rowId}`}
            />
          )}
        </div>
      );
    };
  
    const renderPlaceholderRow = (
      item: Extract<FlatTreeItem<T>, { kind: "children-loading" | "children-error" }>,
      start: number,
      itemHeight: number
    ): ReactNode => {
      const { parentRow, parentId } = item;
      const reload = () => reloadChildren(parentRow, parentId);
      const collapse = () => collapseRow(parentId);
      const indent = item.depth * indentSize;
  
      let body: ReactNode;
      if (item.kind === "children-loading") {
        body =
          renderChildrenLoading?.({ row: parentRow, rowId: parentId, reload, collapse }) ?? (
            <span
              className="rfg-tree-children-loading"
              role="status"
              aria-live="polite"
              aria-label="Loading rows"
            >
              <span className="rfg-skeleton-bar" style={{ width: "30%" }} />
              <span className="rfg-skeleton-bar" style={{ width: "45%" }} />
            </span>
          );
      } else {
        body =
          renderChildrenError?.({
            row: parentRow,
            rowId: parentId,
            error: item.error,
            reload,
            collapse,
          }) ?? (
            <span className="rfg-tree-children-error" role="alert">
              <span>Could not load rows.</span>
              <button
                type="button"
                className="rfg-btn"
                data-testid={`tree-children-retry-${parentId}`}
                onClick={reload}
              >
                Retry
              </button>
            </span>
          );
      }
  
      return (
        <div
          key={item.id}
          role="row"
          className="rfg-row rfg-tree-placeholder-row"
          data-testid={`tree-${item.kind}-${parentId}`}
          style={{
            transform: `translateY(${start}px)`,
            height: itemHeight,
            width: rowWidth,
          }}
        >
          <div
            role="gridcell"
            aria-colindex={1}
            aria-colspan={cols.length}
            className="rfg-cell rfg-tree-placeholder"
            style={{ width: containerWidth || "100%", paddingLeft: indent }}
          >
            {body}
          </div>
        </div>
      );
    };
  
    const isEmptyData = data.length === 0;
    const hasNoResults = !isEmptyData && items.length === 0;
  
    /* ---------------- render ---------------- */
    const showToolbar = showSearch || showColumnsPanel || toolbarStart || toolbarEnd;
  
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
                menuPortalContainer={menuPortalContainer}
                portalClassName={className}
              />
            )}
            <span className="rfg-toolbar-spacer" />
            {toolbarEnd}
          </div>
        )}
  
        <div
          ref={scrollRef}
          className="rfg-scroll"
          style={{ height }}
          onScroll={onScroll}
          role="treegrid"
          tabIndex={0}
          aria-label={ariaLabel}
          aria-rowcount={items.length + 1 + (showGrandTotal ? 1 : 0)}
          aria-colcount={cols.length}
          aria-busy={isLoading}
          data-testid="rfg-tree-scroll"
        >
          {/* header — sticky top */}
          <div
            className="rfg-header"
            role="row"
            aria-rowindex={1}
            style={{ height: headerHeight, width: rowWidth }}
          >
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
                  menuPortalContainer={menuPortalContainer}
                  portalClassName={className}
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
              hasExpander={false}
            />
          ) : items.length === 0 ? (
            <div
              className="rfg-empty"
              role="row"
              data-testid={hasNoResults ? "rfg-no-results" : "rfg-empty"}
            >
              <div role="gridcell">{hasNoResults ? noResultsMessage : emptyMessage}</div>
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
  
                if (item.kind !== "row") {
                  return renderPlaceholderRow(item, vi.start, vi.height);
                }
  
                return (
                  <div
                    key={item.id}
                    role="row"
                    aria-rowindex={vi.index + 2}
                    aria-level={item.depth + 1}
                    aria-posinset={item.posInSet}
                    aria-setsize={item.setSize}
                    aria-expanded={item.canExpand ? item.expanded : undefined}
                    data-depth={item.depth}
                    data-testid={`tree-row-${item.id}`}
                    className={clsx(
                      "rfg-row",
                      item.depth > 0 && "rfg-tree-row--child",
                      onRowClick && "rfg-row--clickable"
                    )}
                    style={{
                      transform: `translateY(${vi.start}px)`,
                      height: vi.height,
                      width: rowWidth,
                    }}
                    onClick={onRowClick ? () => onRowClick(item.row) : undefined}
                  >
                    {cols.map((col) => renderDataCell(col, item))}
                  </div>
                );
              })}
            </div>
          )}
  
          {/* grand total — sticky bottom, root rows only */}
          {showGrandTotal && !isLoading && totals && items.length > 0 && (
            <div
              className="rfg-total-row"
              role="row"
              data-testid="rfg-grand-total"
              style={{ height: rowHeight, width: rowWidth }}
            >
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
                    role="gridcell"
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
   * Hierarchical variant of `DataTable`: expanding a row renders its children
   * as ordinary rows *under the same column headings* (a continuation of the
   * table) instead of a detail panel. Supports sync and async children with
   * inline loading/error rows, per-level sorting that keeps subtrees intact,
   * tree-aware search, root-level grand totals and per-cell info tooltips —
   * while sharing the column system (pinning, reorder, menus, visibility,
   * highlights, persistence) with `DataTable`.
   */
  const TreeDataTableWithRef = forwardRef(TreeDataTableInner);
  TreeDataTableWithRef.displayName = "TreeDataTable";
  
  export const TreeDataTable = TreeDataTableWithRef as <T>(
    props: TreeDataTableProps<T> & { ref?: Ref<DataTableHandle> }
  ) => ReactElement;