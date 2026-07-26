# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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