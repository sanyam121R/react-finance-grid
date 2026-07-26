# react-finance-grid

High-performance, financial-grade data table for React 18+. TypeScript-first,
**zero runtime dependencies**, SSR-safe, tree-shakeable, ESM + CJS + types.

> Working package name: `react-finance-grid`. The final npm scope/name can be
> changed in `package.json` before publish without any code changes.

## Features

- 🦴 **Skeleton loading** — `isLoading` renders shimmer rows matching your real
  columns; standalone `<TableSkeleton />` works as a `<Suspense>` fallback.
- 📌 **Pinned (fixed) columns, left *and* right** — any number, initial
  position via `column.pin`, runtime pin/unpin button in every header,
  controlled or uncontrolled pinning state, deterministic sticky offsets.
- ↔️ **Horizontal scrolling** — the viewport scrolls; pinned columns stay put
  with correct layering and edge shadows.
- 🔽 **Expandable rows** — many rows expanded at once, custom panel renderer,
  nested content (even a nested `DataTable`) supported; stable `onRowExpand`
  extension point reserved for future async detail loading.
- 💰 **Grand total row** — sticky bottom; `sum` / `avg` / `min` / `max` /
  `count` / custom function per column; totals over **all** or **filtered**
  rows; custom finance formatters via `renderTotal`.
- 🪟 **Windowed rendering** — only visible rows (+ overscan) are mounted;
  binary-search virtualizer handles 100k+ rows and mixed row/panel heights.
- ⇅ **Sorting** — header button cycles asc → desc → off; smart default
  comparator (number / Date / numeric-aware locale strings, nulls last);
  per-column `sortFn` override; controlled or uncontrolled.
- 🔎 **Search** — optional built-in toolbar; searches configured columns;
  controlled or uncontrolled value.
- ↔ **Resizable + stretch columns** — drag handles (pointer) and keyboard
  (Arrow keys) resizing with `minWidth`/`maxWidth` clamping; `stretch` columns
  absorb leftover container width; stable with pinned columns.
- ♿ **Accessible** — keyboard-reachable controls, `aria-sort`,
  `aria-expanded`, `aria-pressed`, labelled buttons, `role="table/row/cell"`,
  `aria-rowcount`/`aria-colcount`/`aria-rowindex`, visible focus rings,
  `prefers-reduced-motion` respected.

## Installation

```bash
npm install react-finance-grid
```

Peer dependencies: `react >= 18`, `react-dom >= 18`.

### CSS import

```ts
import "react-finance-grid/styles.css";
```

## Quick start

```tsx
import { DataTable, type ColumnDef } from "react-finance-grid";
import "react-finance-grid/styles.css";

interface DeptRow {
  id: string;
  department: string;
  budget: number;
  actual: number;
  variance: number;
}

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const columns: ColumnDef<DeptRow>[] = [
  { id: "department", header: "Department", accessorKey: "department", pin: "left" },
  {
    id: "budget",
    header: "Budget",
    accessorKey: "budget",
    align: "right",
    aggregate: "sum",
    cell: (row) => usd(row.budget),
    renderTotal: (v) => (v === null ? "—" : usd(v)),
  },
  { id: "actual", header: "Actual", accessorKey: "actual", align: "right", aggregate: "sum" },
  {
    id: "variance",
    header: "Variance",
    accessorFn: (r) => r.budget - r.actual, // accessorFn pattern
    align: "right",
    aggregate: (rows) => rows.reduce((s, r) => s + (r.budget - r.actual), 0),
  },
];

export function BudgetTable({ rows, loading }: { rows: DeptRow[]; loading: boolean }) {
  return (
    <DataTable<DeptRow>
      data={rows}
      columns={columns}
      getRowId={(r) => r.id}
      height={480}
      isLoading={loading}
      showSearch
      showGrandTotal
      grandTotalLabel="Total budget"
    />
  );
}
```

### Suspense fallback

```tsx
import { Suspense, lazy } from "react";
import { TableSkeleton } from "react-finance-grid";

const Dashboard = lazy(() => import("./Dashboard"));

<Suspense fallback={<TableSkeleton rows={10} columns={6} height={480} />}>
  <Dashboard />
</Suspense>;
```

## Advanced example — expansion, right pin, controlled state

```tsx
import { useState } from "react";
import {
  DataTable,
  type ColumnPinningState,
  type SortState,
} from "react-finance-grid";

function AdvancedTable({ rows }: { rows: DeptRow[] }) {
  const [sort, setSort] = useState<SortState | null>({ columnId: "budget", direction: "desc" });
  const [pinning, setPinning] = useState<ColumnPinningState>({ left: ["department"], right: ["status"] });
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  return (
    <DataTable<DeptRow>
      data={rows}
      columns={columns}
      getRowId={(r) => r.id}
      /* controlled everything */
      sortState={sort}
      onSortStateChange={setSort}
      columnPinning={pinning}
      onColumnPinningChange={setPinning}
      expandedRowIds={expanded}
      onExpandedRowIdsChange={setExpanded}
      /* expansion — panels may contain anything, incl. nested DataTables */
      expandedRowHeight={240}
      renderExpandedRow={({ row, collapse }) => (
        <div>
          <QuarterBreakdown department={row} />
          <button onClick={collapse}>Close</button>
        </div>
      )}
      /* reserved async extension point (see Roadmap) */
      onRowExpand={(row) => prefetchDetails(row.id)}
      showGrandTotal
      totalsScope="filtered"
    />
  );
}
```

## API reference

### `<DataTable<T> />`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `T[]` | — | Row data |
| `columns` | `ColumnDef<T>[]` | — | Column definitions |
| `getRowId` | `(row: T, index: number) => string` | — | Stable row id (required) |
| `height` | `number \| string` | `480` | Scroll viewport height |
| `rowHeight` | `number` | `44` | Fixed row height (windowing contract) |
| `overscan` | `number` | `6` | Extra rows above/below viewport |
| `disableVirtualization` | `boolean` | `false` | Render all rows |
| `isLoading` / `skeletonRowCount` | `boolean` / `number` | `false` / `8` | Skeleton state |
| `renderExpandedRow` | `(ctx: ExpansionContext<T>) => ReactNode` | — | Enables expander column |
| `getRowCanExpand` | `(row: T) => boolean` | all rows | Per-row opt-out |
| `expandedRowHeight` | `number` | `200` | Declared panel height (px) |
| `expandedRowIds` / `onExpandedRowIdsChange` | `ReadonlySet<string>` | uncontrolled | Controlled expansion |
| `onRowExpand` | `(row: T) => void \| Promise<void>` | — | Future async hook; fired on expand |
| `sortState` / `onSortStateChange` / `defaultSortState` | `SortState \| null` | uncontrolled | Sorting |
| `showSearch` / `searchPlaceholder` | `boolean` / `string` | `false` | Built-in toolbar |
| `searchValue` / `onSearchValueChange` / `defaultSearchValue` | `string` | uncontrolled | Search |
| `columnPinning` / `onColumnPinningChange` | `ColumnPinningState` | from `column.pin` | Pinning |
| `showGrandTotal` / `grandTotalLabel` | `boolean` / `ReactNode` | `false` / `"Grand total"` | Totals row |
| `totalsScope` | `"filtered" \| "all"` | `"filtered"` | Totals dataset |
| `emptyMessage` | `ReactNode` | `"No results"` | Empty state |
| `toolbarContent` | `ReactNode` | — | Extra toolbar content |
| `onRowClick` | `(row: T) => void` | — | Row click handler |
| `ariaLabel` | `string` | `"Data table"` | Accessible grid name |
| `className` | `string` | — | Root class |

### `ColumnDef<T>`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | — | Unique column id |
| `header` | `ReactNode \| (ctx: HeaderContext<T>) => ReactNode` | `id` | Static or rendered header |
| `accessorKey` | `keyof T & string` | — | Property accessor |
| `accessorFn` | `(row: T) => unknown` | — | Function accessor (wins over key) |
| `cell` | `(row: T, value: unknown) => ReactNode` | `String(value)` | Cell renderer |
| `width` / `minWidth` / `maxWidth` | `number` | `160` / `64` / `∞` | Sizing |
| `stretch` | `boolean` | `true` | Absorb leftover width |
| `resizable` | `boolean` | `true` | Drag/keyboard resize |
| `pin` | `"left" \| "right" \| false` | `false` | Initial pin side (also pin-button target) |
| `pinnable` | `boolean` | `true` | Show pin control |
| `sortable` / `sortFn` | `boolean` / `(a,b)=>number` | `true` / smart compare | Sorting |
| `searchable` / `getSearchText` | `boolean` / `(row)=>string` | `true` / `String(value)` | Search |
| `aggregate` | `"sum"\|"avg"\|"min"\|"max"\|"count"\|(rows: T[]) => number\|null` | — | Grand total |
| `renderTotal` | `(value, rows) => ReactNode` | locale number | Total formatter |
| `align` | `"left"\|"center"\|"right"` | `"left"` | Alignment |
| `className` / `headerClassName` | `string` | — | Extra classes |

### `<TableSkeleton />`

| Prop | Type | Default |
| --- | --- | --- |
| `rows` | `number` | `8` |
| `columns` | `number` | `5` |
| `rowHeight` | `number` | `44` |
| `height` | `number \| string` | — |
| `className` | `string` | — |

### Exported types

`ColumnDef`, `DataTableProps`, `TableSkeletonProps`, `SortState`,
`SortDirection`, `ColumnPinningState`, `PinSide`, `Aggregate`, `AggregateFn`,
`TotalsScope`, `Align`, `HeaderContext`, `ExpansionContext`.

## Controlled vs. uncontrolled

Sorting, search, pinning and expansion all follow the same convention:

- **Uncontrolled**: omit the value prop (optionally pass `default*`); the grid
  owns the state. `on*Change` still fires as a notification.
- **Controlled**: pass the value prop (`sortState`, `searchValue`,
  `columnPinning`, `expandedRowIds`); the grid renders exactly that state and
  calls `on*Change` with the requested next state — you decide whether to apply it.

## Architecture notes

- **Div-based grid** (`role="table"` semantics) rather than `<table>`:
  absolute-positioned virtual rows and sticky pinned cells are not reliable
  inside native table layout.
- **Windowing**: fixed `rowHeight` per data row and declared
  `expandedRowHeight` per panel. A prefix-sum + binary-search virtualizer
  computes the visible window in O(log n) per scroll frame. This is the
  simplest robust design; measured variable-height rows are intentionally out
  of scope for v0.1 (see Tradeoffs).
- **Pinning**: pure function `computeColumnLayout` orders columns
  (left-pinned → unpinned → right-pinned) and produces cumulative sticky
  `left`/`right` offsets; CSS `position: sticky` does the rest, so there are no
  cloned "frozen" tables to keep in sync.
- **State**: one `useControllableState` primitive powers every
  controlled/uncontrolled pair; expensive derivations (filter → sort → flatten
  → window → totals) are memoized stages.
- **SSR**: no browser global is touched at import time; measurement uses a
  guarded `ResizeObserver` inside an isomorphic layout effect; server renders
  a correct initial window from the numeric `height` prop.

## Performance notes

- Only the visible window (+ `overscan`) is mounted; keep `overscan` small.
- Keep `columns` and `data` referentially stable (`useMemo`/`useState`) to
  avoid re-running the filter/sort/total pipelines.
- `rowHeight` must match your CSS row height for correct windowing.
- For >100k rows prefer server-side filtering; client search is a linear scan
  (memoized, but it reruns per query change).

## Accessibility notes

- Sort buttons expose state via `aria-sort` on the column header and labelled
  buttons; pin buttons expose `aria-pressed`; expanders expose `aria-expanded`.
- Resize handles are real buttons: focus them and press **←**/**→** to resize
  in 16px steps (drag also supported).
- `aria-rowcount`/`aria-rowindex` describe the full virtualized dataset even
  though only a window is in the DOM.

## Known tradeoffs

- Fixed row/panel heights (no per-row auto-measure) — by design for v0.1.
- Search is not debounced internally; control `searchValue` externally if you
  need debouncing (keeps the API and tests deterministic).
- When stretch distribution hits a column's `maxWidth`, remaining space is not
  re-distributed a second pass (kept single-pass for predictability).
- `role="table"` semantics (not `role="grid"`): no built-in 2-D cell keyboard
  navigation yet (see Roadmap).

## Roadmap

- **Async row expansion** (planned next): `onRowExpand` may return a Promise
  today; a future `useAsyncRowDetails` helper will add per-row
  loading/error/data states without breaking the current API. Controlled
  `expandedRowIds` already enables orchestrating fetches externally.
- Multi-column sort; `role="grid"` keyboard navigation; column visibility;
  CSV export; sticky group headers.

## Local development

```bash
npm install
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run test        # vitest (jsdom + node SSR suite)
npm run build       # tsup -> dist (ESM+CJS+d.ts) + styles.css
npm run validate:exports
npm run demo:build  # bundles demo/ -> demo/dist
```

## Publish steps

```bash
# 1. Optionally rename/scope the package in package.json
# 2. Update CHANGELOG.md and bump the version
npm version patch|minor|major
# 3. prepublishOnly runs lint+typecheck+test+build+export validation
npm publish --access public
```

## License

MIT