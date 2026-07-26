# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2025-01-02

### Changed (breaking)
- **Pinning is now "pin in place".** Pinning a column no longer moves it to the
  far left/right. Column position is owned solely by `columnOrder`; a pinned
  column sticks at the cumulative width of the pinned columns preceding
  (left) or following (right) it. `ColumnPinningState` is now membership-only —
  the order of ids inside `left`/`right` is not significant.
- `DataTable` is now a `forwardRef` component exposing `DataTableHandle`
  (`serializeLayout` / `restoreLayout` / `resetLayout`). `typeof DataTable` is
  `"object"` rather than `"function"`.
- Search that filters every row out now renders `noResultsMessage`
  ("No matching rows") instead of `emptyMessage`.
- Columns without an explicit `align` are right-aligned when their sampled
  values are numeric.
- Default row height now comes from the `density` preset (`comfortable` = 44px,
  unchanged default); an explicit `rowHeight` still wins.
- `toolbarContent` is deprecated in favour of `toolbarStart` / `toolbarEnd`
  (still rendered for compatibility).

### Added
- **Column drag reorder**: header grip handle (HTML5 DnD), keyboard ←/→,
  menu *Move left/right*; controlled/uncontrolled `columnOrder`
  (+ `defaultColumnOrder`), `enableColumnReorder`, per-column `movable`.
- **Per-column header menu** (`enableColumnMenu`, `column.menu`): sort
  asc/desc/clear (+ add-to-sort in multi-sort), pin left/right/unpin, move
  left/right, reset width, hide column, highlight colours. Portalled, keyboard
  navigable (↑ ↓ Home End), Escape closes and restores focus.
- **Column highlighting**: `none | blue | green | yellow | red | purple` on
  header/body/total cells, themeable CSS variables, `column.highlight`,
  controlled `columnHighlights`, `highlightTotals`, `column.highlightable`.
- **Async row expansion**: `loadRowDetails` with per-row
  `idle → loading → success | error` states, built-in skeleton (`role="status"`)
  and error panel with retry (`role="alert"`), custom `renderDetailLoading` /
  `renderDetailError`, success caching, stale-response protection, independent
  concurrent loads, and controlled `rowDetailStates` / `onRowDetailStatesChange`
  / `onRowDetailReload`. `ExpansionContext` now carries `detail` and `reload`.
- **Column visibility**: `column.hidden` / `column.hideable`, controlled
  `columnVisibility`, menu *Hide column*, toolbar *Columns* panel
  (`showColumnsPanel`) with *Show all columns* and *Reset layout*; hidden
  columns keep their slot in the order.
- **Layout persistence**: `GridLayoutState`, `defaultLayout`, `onLayoutChange`,
  imperative `serializeLayout()` / `restoreLayout()` / `resetLayout()`, and
  storage-agnostic helpers `serializeLayout`, `parseLayout`,
  `reconcileLayout`, `createEmptyLayout`, `LAYOUT_VERSION`.
- **Multi-sort**: `multiSort`, `sorting` / `onSortingChange` / `defaultSorting`,
  shift-click chaining, sort-position badges, exported helpers
  `cycleSingleSort`, `cycleMultiSort`, `addSort`, `removeSort`,
  `setSingleSort`, `makeSortComparator`.
- **Density modes**: `density="compact" | "comfortable" | "spacious"` for the
  grid and `TableSkeleton`.
- **Controlled column widths**: `columnWidths` / `onColumnWidthsChange` /
  `defaultColumnWidths`, plus menu *Reset width*.
- **Toolbar slots**: `toolbarStart`, `toolbarEnd`.
- **Distinct empty states**: `noResultsMessage` vs `emptyMessage`.
- **Finance formatter helpers**: `formatCurrency` (accounting negatives,
  compact notation), `createCurrencyFormatter`, `formatPercent`,
  `formatNumber`, `formatVariance`.
- `column.label` for accessible control names; `data-column-id`,
  `data-pinned` and `data-highlight` attributes on cells.

## [0.1.0] - 2025-01-01

### Added
- Initial release of `react-finance-grid`.
- `DataTable<T>` component with:
  - Windowed (virtualized) row rendering for large datasets.
  - Left **and** right pinned (sticky) columns with header pin/unpin controls,
    controlled & uncontrolled pinning state.
  - Horizontal scrolling with correct sticky offsets, layering and edge shadows.
  - Expandable rows (multiple simultaneously, nested content supported) with a
    future-proof `onRowExpand` async extension point.
  - Sticky grand-total row with `sum`/`avg`/`min`/`max`/`count`/custom
    aggregations, computed over all or filtered rows, custom formatters.
  - Header sort controls (asc → desc → off), smart default comparator,
    per-column comparator override, controlled & uncontrolled.
  - Global search across configured columns, controlled & uncontrolled.
  - Drag + keyboard column resizing with min/max clamping and stretch columns.
  - Skeleton loading rows matching the table structure.
- Standalone `TableSkeleton` component for `<Suspense>` fallbacks.
- Themeable CSS via custom properties (`dist/styles.css`).