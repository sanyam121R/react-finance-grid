# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] (unreleased)

### Added

- **`TreeDataTable`** — hierarchical variant of `DataTable` where expanding a
  row renders its children as ordinary rows *under the same column headings*
  (a continuation of the table) instead of a detail panel. Children are rows
  of the same type, so alignment, pinning, menus, visibility, highlights,
  resize/reorder and layout persistence are shared with `DataTable` by
  construction.
  - Sync children via `getRowChildren`, or async via
    `loadRowChildren(row, rowId, { signal })` with inline loading/error rows,
    retry, caching and abort-on-unmount/supersede. Controlled mode via
    `rowChildrenStates` / `onRowChildrenReload`.
  - Sorting is applied independently to every sibling group — subtrees stay
    glued under their parent in both directions, including multi-sort.
  - Tree-aware search: ancestors of matches stay visible and matching
    branches are revealed under collapsed parents.
  - Grand total aggregates **root rows only** (expanding never double-counts).
  - Treegrid a11y: `role="treegrid"`, `aria-level`, `aria-expanded`,
    `aria-posinset` / `aria-setsize`.
  - `treeColumnId` (chevron/indent placement) and `indentSize` presentation
    options.
- **`InfoTooltip`** — accessible "ⓘ" tooltip (also exported standalone for
  use in `DataTable` cells): opens on hover with intent delay and on keyboard
  focus immediately; interactive content (links/buttons) stays reachable via
  a close grace period; Escape dismisses; portalled and viewport-aware.
  Integrated per column via `TreeColumnDef.infoTip(row, rowId)` — return
  content to show the icon, or `null` to omit it per row.
- New CSS (append-only) with theme hooks: `--rfg-tooltip-bg`,
  `--rfg-tooltip-text`, `--rfg-tooltip-link`, `--rfg-tree-child-bg`.
- Rows expanded via `defaultExpandedRowIds` / controlled `expandedRowIds`
  auto-start their async children load (idle rows only — errored rows wait
  for an explicit Retry). The tree column falls back to the first *visible*
  column when the preferred one is hidden, so expand controls are never
  stranded. Tooltips stay open while focus moves into their interactive
  content. Tree flattening/sorting is memoized and does not re-run on scroll.

### Docs / demo

- The demo is now a **version-tabbed showcase** (0.1.0 core grid · 0.2.0
  power columns · 0.2.1 hardening · 0.3.0 tree + tooltips), covered by a
  smoke test. README gained `TreeDataTable` / `InfoTooltip` quick starts and
  API tables, and drifted prop defaults were corrected against the source
  (`minWidth` 64, `width` 160, `stretch` `true`, `expandedRowHeight` 200,
  `grandTotalLabel` `"Grand total"`, `loadRowDetails` `ctx` signature,
  `ReadonlySet` expansion state; removed nonexistent `footer`/`meta` fields).

## [0.2.1] (unreleased)

### Fixed

- **Async row expansion:** `loadRowDetails` now receives the documented third
  `ctx` argument. `ctx.signal` is a real `AbortSignal` that aborts when the
  request is superseded by `reload()` or when the grid unmounts. Loaders that
  destructure `ctx` (or throw synchronously) no longer wedge the row in a
  permanent error state; Retry always issues a fresh request.
- **Column resize:** interrupted drags (component unmount, `pointercancel`)
  now tear down their `window` listeners and restore the document cursor /
  text selection instead of leaking them.
- **Sorting:** the default comparator no longer returns `NaN` for `NaN` cell
  values or invalid `Date`s. Missing values (`null`/`undefined`/`""`/`NaN`/
  Invalid Date) sort last, and surrounding rows sort correctly instead of
  coming back unordered.
- **Sorting:** plain-clicking a column that is part of a multi-sort chain now
  collapses the chain *and* continues that column's asc → desc → off cycle,
  instead of resetting it to ascending.
- **Grand total:** the sticky totals row is hidden when there are no rows to
  total (empty data, or search filtered everything out).
- **Menus:** `ArrowUp` pressed before any item has focus now wraps to the last
  enabled item (WAI-ARIA menu pattern).
- **Types:** repaired a corrupted JSDoc comment on `menuPortalContainer` that
  shipped in the published `.d.ts`.

### Changed

- **Columns panel:** visibility checkboxes keep the panel open so several
  columns can be toggled in one visit. Command items ("Show all columns",
  "Reset layout") still close it.

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