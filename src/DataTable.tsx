import {
    useCallback,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type UIEvent,
  } from "react";
  import type {
    DataTableProps,
    SortState,
  } from "./types";
  import { useControllableState } from "./hooks/useControllableState";
  import { useIsomorphicLayoutEffect } from "./hooks/useIsomorphicLayoutEffect";
  import { useColumnLayout, type ResolvedColumn } from "./hooks/useColumnLayout";
  import { useVirtualRows } from "./hooks/useVirtualRows";
  import { HeaderCell, pinnedCellClass, pinnedCellStyle } from "./components/HeaderCell";
  import { SkeletonRows } from "./components/TableSkeleton";
  import { ChevronIcon, SearchIcon } from "./components/icons";
  import { getCellValue, getSearchText } from "./utils/accessors";
  import { defaultCompare } from "./utils/compare";
  import { aggregateRows, formatNumber } from "./utils/aggregate";
  import { EXPANDER_WIDTH } from "./utils/layout";
  import { clsx } from "./utils/clsx";
  
  type Item<T> =
    | { kind: "row"; row: T; id: string; dataIndex: number }
    | { kind: "detail"; row: T; id: string; dataIndex: number };
  
  /**
   * Financial-grade data table: virtualized rows, left/right pinned columns,
   * sorting, search, expandable rows, sticky grand totals, resizable columns.
   */
  export function DataTable<T>(props: DataTableProps<T>) {
    const {
      data,
      columns,
      getRowId,
      height = 480,
      rowHeight = 44,
      overscan = 6,
      disableVirtualization = false,
      isLoading = false,
      skeletonRowCount = 8,
      renderExpandedRow,
      getRowCanExpand,
      expandedRowHeight = 200,
      showSearch = false,
      searchPlaceholder = "Search…",
      showGrandTotal = false,
      grandTotalLabel = "Grand total",
      totalsScope = "filtered",
      emptyMessage = "No results",
      className,
      toolbarContent,
      onRowClick,
      onRowExpand,
      ariaLabel = "Data table",
    } = props;
  
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
  
    /* ---------------- column layout: pin / resize / stretch ---------------- */
    const {
      columns: cols,
      totalWidth,
      togglePin,
      startResizeDrag,
      nudgeColumnWidth,
    } = useColumnLayout<T>({
      columns,
      containerWidth,
      hasExpander,
      columnPinning: props.columnPinning,
      onColumnPinningChange: props.onColumnPinningChange,
    });
  
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
  
    /* ---------------- sorting ---------------- */
    const [sort, setSort] = useControllableState<SortState | null>(
      props.sortState,
      props.onSortStateChange,
      props.defaultSortState ?? null
    );
  
    const toggleSort = useCallback(
      (columnId: string) => {
        if (sort?.columnId !== columnId) {
          setSort({ columnId, direction: "asc" });
        } else if (sort.direction === "asc") {
          setSort({ columnId, direction: "desc" });
        } else {
          setSort(null);
        }
      },
      [sort, setSort]
    );
  
    const sorted = useMemo(() => {
      if (!sort) return filtered;
      const col = columns.find((c) => c.id === sort.columnId);
      if (!col) return filtered;
      const dir = sort.direction === "asc" ? 1 : -1;
      const cmp = col.sortFn
        ? col.sortFn
        : (a: T, b: T) => defaultCompare(getCellValue(col, a), getCellValue(col, b));
      return [...filtered].sort((a, b) => cmp(a, b) * dir);
    }, [filtered, sort, columns]);
  
    /* ---------------- expansion ---------------- */
    const [expandedIds, setExpandedIds] = useControllableState<ReadonlySet<string>>(
      props.expandedRowIds,
      props.onExpandedRowIdsChange,
      () => new Set<string>()
    );
  
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
          // Stable extension point for future async detail loading.
          void onRowExpand?.(row);
        }
        setExpandedIds(next);
      },
      [expandedIds, setExpandedIds, onRowExpand]
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
      return (
        <div
          key={def.id}
          role="cell"
          className={clsx(
            "rfg-cell",
            pinnedCellClass(col),
            def.align === "right" && "rfg-cell--right",
            def.align === "center" && "rfg-cell--center",
            def.className
          )}
          style={pinnedCellStyle(col)}
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
  
    /* ---------------- render ---------------- */
    return (
      <div className={clsx("rfg-root", className)}>
        {(showSearch || toolbarContent) && (
          <div className="rfg-toolbar">
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
            {cols.map((col) => (
              <HeaderCell<T>
                key={col.id}
                col={col}
                sort={sort}
                onSortToggle={toggleSort}
                onPinToggle={togglePin}
                onResizeDragStart={startResizeDrag}
                onResizeNudge={nudgeColumnWidth}
              />
            ))}
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
            <div className="rfg-empty" role="row">
              <div role="cell">{emptyMessage}</div>
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
                        {renderExpandedRow?.({
                          row: item.row,
                          rowId: item.id,
                          collapse: () => collapseRow(item.id),
                        })}
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
                      ? formatNumber(value)
                      : "—";
                } else if (i === labelColumnIndex) {
                  content = grandTotalLabel;
                }
                return (
                  <div
                    key={col.id}
                    role="cell"
                    className={clsx(
                      "rfg-cell",
                      pinnedCellClass(col),
                      col.def.align === "right" && "rfg-cell--right",
                      col.def.align === "center" && "rfg-cell--center"
                    )}
                    style={pinnedCellStyle(col)}
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