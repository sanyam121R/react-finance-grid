# react-finance-grid

High-performance, financial-grade data table for React 18+. TypeScript-first, **zero runtime dependencies**, SSR-safe, tree-shakeable, ESM + CJS + types.

> Working package name: `react-finance-grid`. The final npm scope/name can be changed in `package.json` before publish without any code changes.

## Demo

![Demo](demo/images/Demo.png)

The bundled demo (`npm run demo:build`, see [demo/README.md](demo/README.md)) is a
**version-tabbed showcase** — one live tab per release:

| Tab | Illustrates |
| --- | --- |
| **0.1.0 · Core grid** | 5,000 virtualized rows, pinned columns, sorting, search, resizing, sticky grand total, sync expandable rows (nested grid), skeleton loading |
| **0.2.0 · Power columns** | Drag/keyboard reorder, per-column menu, pin-in-place, highlighting, multi-sort, visibility panel, density, async row expansion with retry, layout persistence |
| **0.2.1 · Hardening** | NaN/null-safe sorting demo, abortable detail requests (`ctx.signal`) with a live abort counter, empty-state/grand-total fixes |
| **0.3.0 · Tree + tooltips** | `TreeDataTable` — children as a continuation of the table under the same headers — and `InfoTooltip` ⓘ cell tooltips (View Details ›, regional breakdowns), sync *and* async children |

## Features

- 🌳 **`TreeDataTable` — hierarchical rows as a continuation of the table** *(v0.3.0)* — expanding a row renders its children as ordinary rows **under the same column headings** (indented, chevron inline) instead of a detail panel. Sync children (`getRowChildren`) or async (`loadRowChildren` with inline loading/error rows, retry, caching, `AbortSignal`); per-level sorting that never tears subtrees apart; tree-aware search; root-only grand totals; treegrid a11y (`aria-level`, `aria-expanded`, `aria-posinset`/`aria-setsize`). Shares the entire column system (pinning, reorder, menus, visibility, highlights, persistence) with `DataTable`.
- ⓘ **`InfoTooltip`** *(v0.3.0)* — accessible info tooltip for per-row/per-cell details (e.g. regional breakdowns, "View Details ›" links). Opens on hover with intent delay and on keyboard focus immediately; **interactive content stays reachable**; Escape dismisses; portalled + viewport-aware. Wire it per column with `TreeColumnDef.infoTip(row, rowId)` or use it standalone anywhere.
- 🦴 **Skeleton loading** — `isLoading` renders shimmer rows matching your real columns; standalone `<TableSkeleton />` works as a `<Suspense>` fallback.
- 📌 **Pin in place (left *and* right)** — pinning **never moves a column**; it sticks where the user put it. Header pin button + menu actions, controlled or uncontrolled pinning state, deterministic sticky offsets.
- ↕️ **Column drag reorder** — grip handle with HTML5 drag & drop, plus keyboard **←/→** and “Move left/right” menu actions; controlled or uncontrolled `columnOrder`, per-column `movable` opt-out.
- ☰ **Per-column menu** — sort asc/desc/clear (+ add-to-sort in multi-sort), pin left/right/unpin, move left/right, hide, reset width, highlight colours; fully keyboard navigable with Escape-to-close + focus restore.
- 🎨 **Column highlighting** — `none | blue | green | yellow | red | purple` applied to header, body and (optionally) total cells, themeable via CSS variables, controlled or uncontrolled.
- 👁️ **Column visibility** — hide from the menu or the toolbar *Columns* panel, `hideable` opt-out, order preserved while hidden, plus *Show all* / *Reset layout*.
- 💾 **Layout persistence** — `serializeLayout()` / `restoreLayout()` / `resetLayout()` via ref + `defaultLayout` / `onLayoutChange`; storage-agnostic.
- ↔️ **Horizontal scrolling** — the viewport scrolls; pinned columns stay put with correct layering and edge shadows.
- 🔽 **Expandable rows, sync *and* async** — many rows expanded at once, custom panel renderer, nested content (even a nested `DataTable`). Pass `loadRowDetails` and the grid manages per-row `idle → loading → success | error` state with built-in skeleton/error UI, retry, independent concurrent loads, and caching; controllable via `rowDetailStates`.
- 💰 **Grand total row** — sticky bottom; `sum` / `avg` / `min` / `max` / `count` / custom function per column; totals over **all** or **filtered** rows; custom finance formatters via `renderTotal`.
- 🪟 **Windowed rendering** — only visible rows (+ overscan) are mounted; binary-search virtualizer handles large datasets and mixed row/panel heights.
- ⇅ **Sorting (single + multi)** — header button cycles asc → desc → off; `multiSort` adds shift-click / menu chaining with sort-position badges; smart default comparator (number / Date / numeric-aware locale strings, nulls last); per-column `sortFn`; controlled or uncontrolled.
- 🔎 **Search** — optional built-in toolbar; searches configured columns; controlled or uncontrolled value.
- ↔ **Resizable + stretch columns** — drag handles (pointer) and keyboard (Arrow keys) resizing with `minWidth`/`maxWidth` clamping; `stretch` columns absorb leftover container width; stable with pinned columns.
- 🧱 **Density modes** — `compact | comfortable | spacious` row heights and padding; explicit `rowHeight` always wins.
- 💱 **Finance formatter helpers** — `formatCurrency` (including accounting negatives + compact), `createCurrencyFormatter`, `formatPercent`, `formatNumber`, `formatVariance`; numeric columns right-align by default.
- 🫙 **Distinct empty states** — `emptyMessage` (no data) vs `noResultsMessage` (search filtered everything out).
- ♿ **Accessible** — keyboard-reachable controls, `aria-sort`, `aria-expanded`, `aria-pressed`, labelled buttons, `role="table/row/cell"`, `aria-rowcount`/`aria-colcount`/`aria-rowindex`, visible focus rings, `prefers-reduced-motion` respected.

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
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const columns: ColumnDef<DeptRow>[] = [
  { id: "department", header: "Department", accessorKey: "department", pin: "left" },
  {
    id: "budget",
    header: "Budget",
    accessorKey: "budget",
    aggregate: "sum",
    cell: (row) => usd(row.budget),
    renderTotal: (v) => (v === null ? "—" : usd(v)),
  },
  { id: "actual", header: "Actual", accessorKey: "actual", aggregate: "sum" },
  {
    id: "variance",
    header: "Variance",
    accessorFn: (r) => r.budget - r.actual,
    aggregate: (rows) => rows.reduce((s, r) => s + (r.budget - r.actual), 0),
  },
];

export function BudgetTable({
  rows,
  loading,
}: {
  rows: DeptRow[];
  loading: boolean;
}) {
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

## Quick start — `TreeDataTable` (v0.3.0)

Hierarchical data where expanding a parent shows its children **in the same
table**, under the same column headings — plus ⓘ info tooltips per cell:

```tsx
import { TreeDataTable, type TreeColumnDef } from "react-finance-grid";
import "react-finance-grid/styles.css";

interface Account {
  id: string;
  name: string;
  fy2025: number;
  regionBreakdown?: { region: string; amount: number }[];
  children?: Account[];
}

const columns: TreeColumnDef<Account>[] = [
  { id: "name", header: "Account", accessorKey: "name" }, // tree column (chevron + indent)
  {
    id: "fy2025",
    header: "FY 2025",
    accessorKey: "fy2025",
    aggregate: "sum",
    // ⓘ appears only on rows that return content
    infoTip: (row) =>
      row.regionBreakdown && (
        <ul>
          {row.regionBreakdown.map((r) => (
            <li key={r.region}>{r.region}: {r.amount}</li>
          ))}
        </ul>
      ),
  },
];

// Synchronous children:
<TreeDataTable<Account>
  data={accounts}
  columns={columns}
  getRowId={(r) => r.id}
  getRowChildren={(r) => r.children}
  showGrandTotal
  grandTotalLabel="Total Expenses" // aggregates ROOT rows only — no double counting
/>;

// …or async children (inline loading/error rows, retry, caching, abort):
<TreeDataTable<Account>
  data={accounts}
  columns={columns}
  getRowId={(r) => r.id}
  loadRowChildren={(row, id, { signal }) =>
    fetch(`/api/accounts/${id}/children`, { signal }).then((r) => r.json())
  }
  getRowCanExpand={(r) => r.hasChildren}
  defaultExpandedRowIds={new Set(["benefits"])}
/>;
```

`InfoTooltip` is also exported standalone — use it inside `DataTable` cells,
toolbars, headers, anywhere:

```tsx
import { InfoTooltip } from "react-finance-grid";

<InfoTooltip
  label="Amount breakdown"
  content={<div>India $2,021 · UK $1,000 · <a href="/details">View Details ›</a></div>}
/>;
```

## Advanced example — pin in place, reorder, menu, async details, persistence

```tsx
import { useCallback, useRef } from "react";
import {
  DataTable,
  parseLayout,
  serializeLayout,
  createCurrencyFormatter,
  type ColumnDef,
  type DataTableHandle,
  type GridLayoutState,
} from "react-finance-grid";

const usd = createCurrencyFormatter({ currency: "USD", locale: "en-US" });

interface DeptRow {
  id: string;
  department: string;
  owner: string;
  budget: number;
  variance: number;
  status: string;
}

interface Quarter {
  quarter: string;
  budget: number;
  actual: number;
}

const columns: ColumnDef<DeptRow>[] = [
  { id: "department", header: "Department", accessorKey: "department", pin: "left", hideable: false },
  { id: "owner", header: "Owner", accessorKey: "owner" },
  {
    id: "budget",
    header: "Budget",
    accessorKey: "budget",
    aggregate: "sum",
    cell: (r) => usd(r.budget),
    renderTotal: (v) => usd(v),
    highlight: "blue",
  },
  { id: "variance", header: "Variance", accessorKey: "variance", aggregate: "sum" },
  { id: "status", header: "Status", accessorKey: "status", pin: "right", movable: false },
];

function Dashboard({ rows }: { rows: DeptRow[] }) {
  const grid = useRef<DataTableHandle>(null);

  const onLayoutChange = useCallback((layout: GridLayoutState) => {
    sessionStorage.setItem("grid-layout", serializeLayout(layout));
  }, []);

  return (
    <>
      <button onClick={() => grid.current?.resetLayout()}>Reset layout</button>
      <DataTable<DeptRow, Quarter[]>
        ref={grid}
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        density="compact"
        multiSort
        showSearch
        showColumnsPanel
        showGrandTotal
        defaultLayout={parseLayout(sessionStorage.getItem("grid-layout"))}
        onLayoutChange={onLayoutChange}
        loadRowDetails={(row) =>
          fetch(`/api/depts/${row.id}/quarters`).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json() as Promise<Quarter[]>;
          })
        }
        expandedRowHeight={260}
        renderExpandedRow={({ row, detail, reload, collapse }) => (
          <div>
            <h4>{row.department} — quarterly actuals</h4>
            <ul>
              {detail.data?.map((q) => (
                <li key={q.quarter}>
                  {q.quarter}: {usd(q.actual)}
                </li>
              ))}
            </ul>
            <button onClick={reload}>Reload</button>
            <button onClick={collapse}>Close</button>
          </div>
        )}
      />
    </>
  );
}
```

## API reference

### `DataTableProps<T, D = unknown>`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `T[]` | — | Table rows |
| `columns` | `ColumnDef<T>[]` | — | Column definitions |
| `getRowId` | `(row: T, index: number) => string` | **required** | Stable unique row id (do not derive it from `index`) |
| `height` | `number \| string` | `480` | Scroll viewport height |
| `rowHeight` | `number` | density preset | Fixed row height (windowing contract) |
| `expandedRowHeight` | `number` | `200` | Declared expanded panel height |
| `density` | `"compact" \| "comfortable" \| "spacious"` | `"comfortable"` | Row height/padding preset |
| `overscan` | `number` | `6` | Extra rows rendered outside the viewport |
| `disableVirtualization` | `boolean` | `false` | Render all rows |
| `isLoading` | `boolean` | `false` | Show skeleton state |
| `showSearch` | `boolean` | `false` | Render built-in search toolbar |
| `searchValue` / `onSearchValueChange` / `defaultSearchValue` | `string` | uncontrolled | Search state |
| `sortState` / `onSortStateChange` / `defaultSortState` | `SortState \| null` | uncontrolled | Single sorting |
| `sorting` / `onSortingChange` / `defaultSorting` | `SortState[]` | uncontrolled | Multi sorting |
| `multiSort` | `boolean` | `false` | Enable shift-click / add-to-sort chaining |
| `columnPinning` / `onColumnPinningChange` / `defaultColumnPinning` | `ColumnPinningState` | from `column.pin` | Pinning membership state |
| `columnOrder` / `onColumnOrderChange` / `defaultColumnOrder` | `string[]` | column array order | Column order |
| `enableColumnReorder` | `boolean` | `true` | Header grip drag & drop |
| `columnWidths` / `onColumnWidthsChange` / `defaultColumnWidths` | `Record<string, number>` | uncontrolled | Explicit widths |
| `columnVisibility` / `onColumnVisibilityChange` / `defaultColumnVisibility` | `Record<string, boolean>` | from `column.hidden` | Visibility |
| `showColumnsPanel` | `boolean` | `false` | Toolbar *Columns* menu |
| `columnHighlights` / `onColumnHighlightsChange` / `defaultColumnHighlights` | `Record<string, HighlightColor>` | from `column.highlight` | Highlighting |
| `highlightTotals` | `boolean` | `true` | Apply highlight to total cells |
| `enableColumnMenu` | `boolean` | `true` | Per-column header menu |
| `expandedRowIds` / `onExpandedRowIdsChange` | `ReadonlySet<string>` | uncontrolled | Expanded row state |
| `onRowExpand` | `(row: T) => void \| Promise<void>` | — | Fire-and-forget hook on expand |
| `loadRowDetails` | `(row: T, rowId: string, ctx: { signal?: AbortSignal }) => Promise<D>` | — | Async detail loader; `ctx.signal` aborts on reload/unmount *(v0.2.1)* |
| `renderExpandedRow` | `(ctx: ExpansionContext<T, D>) => ReactNode` | — | Custom expanded panel |
| `renderDetailLoading` | `(ctx: DetailLoadingContext<T>) => ReactNode` | built-in skeleton | Custom loading panel |
| `renderDetailError` | `(ctx: DetailErrorContext<T>) => ReactNode` | built-in error + retry | Custom error panel |
| `rowDetailStates` / `onRowDetailStatesChange` | `RowDetailStates<D>` | uncontrolled | Controlled async detail state |
| `onRowDetailReload` | `(row: T, rowId: string) => void` | — | Reload hook in controlled mode |
| `showGrandTotal` | `boolean` | `false` | Render sticky total row |
| `grandTotalLabel` | `ReactNode` | `"Grand total"` | Label for summary row |
| `totalsScope` | `"all" \| "filtered"` | `"filtered"` | Rows included in totals |
| `emptyMessage` | `ReactNode` | `"No results"` | Shown when `data` is empty |
| `noResultsMessage` | `ReactNode` | `"No matching rows"` | Shown when search filters all rows out |
| `toolbarStart` / `toolbarEnd` | `ReactNode` | — | Toolbar slots |
| `toolbarContent` | `ReactNode` | — | **Deprecated** — use `toolbarEnd` |
| `defaultLayout` | `GridLayoutState \| null` | — | Hydrate uncontrolled layout |
| `onLayoutChange` | `(layout: GridLayoutState) => void` | — | Fires on layout mutations |
| `menuPortalContainer` | `HTMLElement \| null` | `document.body` | Portal target for menus/panels (themed subtrees) |
| `onRowClick` | `(row: T) => void` | — | Row click handler |
| `ariaLabel` | `string` | `"Data table"` | Accessible grid name |
| `skeletonRowCount` | `number` | `8` | Skeleton rows while `isLoading` |
| `className` | `string` | — | Root class name |

### `ColumnDef<T>`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | required | Unique column id |
| `header` | `ReactNode \| (ctx: HeaderContext<T>) => ReactNode` | `id` | Static or rendered header (`ctx` includes sort direction/index, pin side, highlight) |
| `accessorKey` | `keyof T` | — | Read a row field |
| `accessorFn` | `(row: T) => unknown` | — | Derived value accessor |
| `cell` | `(row: T, value: unknown) => ReactNode` | `String(value)` | Custom cell renderer |
| `renderTotal` | `(value: number \| null, rows: T[]) => ReactNode` | formatted number / `"—"` | Custom total-row renderer |
| `align` | `"left" \| "center" \| "right"` | numeric → `"right"` | Alignment |
| `width` | `number` | `160` | Initial width |
| `minWidth` | `number` | `64` | Minimum width |
| `maxWidth` | `number` | `Infinity` | Maximum width |
| `stretch` | `boolean` | `true` | Absorb leftover container width |
| `sortable` | `boolean` | `true` | Allow sorting |
| `sortFn` | `(a, b) => number` | smart comparator | Custom comparator |
| `searchable` | `boolean` | `true` | Include in global search |
| `getSearchText` | `(row: T) => string` | accessor string | Search text extractor |
| `aggregate` | `"sum" \| "avg" \| "min" \| "max" \| "count" \| AggregateFn<T>` | — | Total-row aggregation |
| `pin` | `"left" \| "right" \| false` | `false` | Initial pin side |
| `pinnable` | `boolean` | `true` | Show pin controls |
| `movable` | `boolean` | `true` | Allow drag/keyboard reorder |
| `hidden` / `hideable` | `boolean` | `false` / `true` | Initial visibility / allow hiding |
| `highlight` / `highlightable` | `HighlightColor` / `boolean` | `"none"` / `true` | Initial highlight / allow highlighting |
| `menu` | `boolean` | `true` | Show per-column menu |
| `label` | `string` | header text or id | Accessible column label |
| `resizable` | `boolean` | `true` | Allow width changes |
| `className` / `headerClassName` | `string` | — | Cell / header cell class name |

### `TreeDataTableProps<T>` (v0.3.0)

`TreeDataTable` shares the column system and most props with `DataTable`
(`height`, `rowHeight`, `density`, `overscan`, `disableVirtualization`,
`isLoading`/`skeletonRowCount`, `sorting`/`multiSort`, search, column
order/pinning/widths/visibility/highlights (+ `showColumnsPanel`),
`enableColumnMenu`/`enableColumnReorder`, `menuPortalContainer`,
`defaultLayout`/`onLayoutChange` + the same `DataTableHandle` ref, grand
total props, empty states, toolbar slots, `onRowClick`, `ariaLabel`).
It replaces the detail-panel expansion props with:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `T[]` | — | **Root** rows (children come from the props below) |
| `columns` | `TreeColumnDef<T>[]` | — | Same as `ColumnDef` + `infoTip` |
| `getRowId` | `(row: T, index: number) => string` | **required** | Stable unique id across the whole tree |
| `getRowChildren` | `(row: T) => readonly T[] \| null \| undefined` | — | Synchronous children (non-empty ⇒ expandable) |
| `loadRowChildren` | `(row, rowId, ctx: { signal? }) => Promise<T[]>` | — | Async children loader (inline loading/error rows, retry, caching, abort). Ignored when `getRowChildren` is set |
| `getRowCanExpand` | `(row: T) => boolean` | sync: children present; async: `true` | Expandability override (`false` always wins) |
| `renderChildrenLoading` / `renderChildrenError` | `(ctx) => ReactNode` | built-in row | Custom inline loading / error (with `reload`) rows |
| `rowChildrenStates` / `onRowChildrenStatesChange` / `onRowChildrenReload` | `RowChildrenStates<T>` | uncontrolled | Controlled async children state |
| `expandedRowIds` / `onExpandedRowIdsChange` / `defaultExpandedRowIds` | `ReadonlySet<string>` | uncontrolled | Expansion state (default-expanded rows auto-load in async mode) |
| `onRowExpand` | `(row: T) => void \| Promise<void>` | — | Fire-and-forget hook on expand |
| `treeColumnId` | `string` | first column | Column carrying indent + chevron (falls back to the first **visible** column) |
| `indentSize` | `number` | `24` | Indent per depth level (px) |

Semantics worth knowing:

- **Sorting** is applied independently to every sibling group — subtrees stay
  glued under their parent in both directions, including multi-sort.
- **Search** is tree-aware: a match keeps its ancestor chain visible and is
  revealed even under collapsed parents; non-matching siblings drop out.
- **Grand total** aggregates **root rows only** (`totalsScope="all"` = all
  roots; `"filtered"` = roots surviving the search).
- A11y: `role="treegrid"`, rows carry `aria-level`, `aria-expanded`,
  `aria-posinset` / `aria-setsize`.

### `TreeColumnDef<T>` (v0.3.0)

Everything from `ColumnDef<T>`, plus:

| Field | Type | Description |
| --- | --- | --- |
| `infoTip` | `(row: T, rowId: string) => ReactNode` | Return tooltip content to render an ⓘ trigger after the cell content; return `null`/`undefined` to omit it for that row |
| `infoTipLabel` | `string` | Accessible name for the ⓘ trigger |

### `InfoTooltipProps` (v0.3.0)

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `content` | `ReactNode` | — | Tooltip body (interactive content supported) |
| `label` | `string` | `"Row details"` | Accessible name for the ⓘ trigger |
| `placement` | `"top" \| "bottom"` | `"top"` | Preferrece runs out |
| `openDelay` / `closeDelay` | `number` | `100` / `150` | Hover intent delays (ms); focus/blur are always immediate; `closeDelay` keeps links reachable |
| `portalContainer` / `portalClassName` | `HTMLElement \| null` / `string` | `document.body` | Portal target / theme class |
| `className` / `testId` | `string` | — | Trigger class / test id |

## Pinning model — “pin in place”

Pinning answers *“stick this column where it is during horizontal scroll”*, **not** *“move this column to the far left/right”*:

- A column’s position is owned exclusively by `columnOrder` (drag reorder / move actions). Pinning and unpinning never reorder anything.
- A **left-pinned** column sticks at the cumulative width of the *left-pinned columns that precede it in the order*.
- A **right-pinned** column mirrors that from the right edge.
- The last left-pinned column in order carries the right-edge shadow; the first right-pinned column carries the left-edge shadow.

| Situation | Behaviour |
| --- | --- |
| Pin column #3 while #1, #2 are unpinned | #3 stays at slot 3; when you scroll right it parks at the left edge and #1/#2 slide beneath it |
| Pin #1 and #3 (left) | They park at the edge in order; #2 scrolls under them |
| Reorder a pinned column | Pin state follows the column; sticky offsets recompute from the new order |
| Pinned columns separated by unpinned ones | Valid; the visual gap between them closes as you scroll |

Because pinned columns are not forced into a contiguous edge group, a pinned column only becomes “frozen” once the scroll position reaches it. If you want the classic frozen-pane look, drag pinned columns to the edge.

## Column reordering

- **Mouse**: drag the grip in the header onto another header cell.
- **Keyboard**: focus the grip and press **←** / **→**, or use the menu’s *Move left* / *Move right* actions.
- `movable: false` removes the grip, disables the move actions, and blocks the column from being used as a drop target.
- Moves operate on *visible* columns, skipping hidden and immovable ones, while the full order is preserved internally.
- Reordering composes with pinning, resizing, sorting, visibility and highlighting.

## Column menu

Enabled by default (`enableColumnMenu`, per column `menu: false`).

| Group | Actions |
| --- | --- |
| Sort | Sort ascending · Sort descending · Clear sort · Add ascending/descending to sort |
| Pin | Pin left · Pin right · Unpin |
| Layout | Move left · Move right · Reset width · Hide column |
| Highlight | Clear highlight · Blue · Green · Yellow · Red · Purple |

Keyboard behavior:
- **Enter/Space** opens.
- **↑ ↓ Home End** move focus.
- **Enter** invokes.
- **Escape** or **Tab** closes and restores focus to the trigger.

## Column highlighting

```tsx
{ id: "budget", header: "Budget", accessorKey: "budget", highlight: "blue" }

<DataTable
  columnHighlights={{ budget: "blue", variance: "red" }}
  onColumnHighlightsChange={setHighlights}
  highlightTotals={false}
/>
```

Variants: `none | blue | green | yellow | red | purple`.

```css
.rfg-root {
  --rfg-hl-blue-bg: #dbeafe;
  --rfg-hl-blue-strong: #3b82f6;
}
```

Highlight wins over row hover styling so emphasized columns stay readable.

## Async row expansion

```tsx
<DataTable<Row, Detail>
  loadRowDetails={(row, rowId, { signal }) => fetchDetail(rowId, { signal })}
  renderDetailLoading={({ rowId }) => <MySkeleton id={rowId} />}
  renderDetailError={({ error, reload }) => (
    <MyError error={error} onRetry={reload} />
  )}
  renderExpandedRow={({ detail, reload, collapse }) => (
    <Panel data={detail.data!} onReload={reload} onClose={collapse} />
  )}
/>
```

- Per-row state machine: `idle → loading → success | error`.
- Rows load independently and concurrently.
- Successful results are cached.
- `reload()` forces a refetch and **aborts** the superseded request via `ctx.signal` (v0.2.1); unmounting aborts all in-flight requests.
- Without `loadRowDetails`, expansion remains synchronous.
- Controlled mode is supported through `rowDetailStates`.

## Column visibility

```tsx
<DataTable
  showColumnsPanel
  columnVisibility={{ owner: false }}
  onColumnVisibilityChange={setVisibility}
/>
```

`column.hidden` seeds uncontrolled state, `column.hideable: false` prevents hiding, and the panel also offers *Show all columns* and *Reset layout*.

## Layout persistence

```tsx
const grid = useRef<DataTableHandle>(null);

<DataTable
  ref={grid}
  defaultLayout={parseLayout(savedJson)}
  onLayoutChange={save}
/>

const snapshot = grid.current!.serializeLayout();
grid.current!.restoreLayout(snapshot);
grid.current!.resetLayout();
```

A layout snapshot contains:
- `version`
- `columnOrder`
- `columnPinning`
- `columnWidths`
- `columnVisibility`
- `columnHighlights`
- `sorting`

## Imperative handle — `DataTableHandle`

| Method | Description |
| --- | --- |
| `serializeLayout()` | Returns the current `GridLayoutState` |
| `restoreLayout(state)` | Applies a snapshot object or JSON string |
| `resetLayout()` | Restores order, pinning, width, visibility, highlight and sorting defaults |

## Exported helpers

`serializeLayout`, `parseLayout`, `reconcileLayout`, `createEmptyLayout`, `formatCurrency`, `createCurrencyFormatter`, `formatPercent`, `formatNumber`, `formatVariance`, `cycleSingleSort`, `cycleMultiSort`, `addSort`, `removeSort`, `setSingleSort`, `makeSortComparator`, `LAYOUT_VERSION`.

Components: `DataTable`, `TreeDataTable` *(v0.3.0)*, `TableSkeleton`, `InfoTooltip` *(v0.3.0)*.

## Exported types

`ColumnDef`, `DataTableProps`, `DataTableHandle`, `TableSkeletonProps`, `SortState`, `SortDirection`, `ColumnPinningState`, `ColumnOrderState`, `ColumnVisibilityState`, `ColumnWidthState`, `ColumnHighlightState`, `HighlightColor`, `Density`, `PinSide`, `Aggregate`, `AggregateFn`, `TotalsScope`, `Align`, `HeaderContext`, `ExpansionContext`, `AsyncDetailState`, `DetailStatus`, `RowDetailStates`, `DetailLoadingContext`, `DetailErrorContext`, `GridLayoutState`, `TreeDataTableProps`, `TreeColumnDef`, `RowChildrenStates`, `ChildrenLoadingContext`, `ChildrenErrorContext`, `InfoTooltipProps`.

## Controlled vs. uncontrolled

Sorting, search, pinning, **column order, widths, visibility, highlights**, expansion, and **async detail states** all follow the same convention:

- **Uncontrolled**: omit the value prop and optionally pass `default*`; the grid owns the state.
- **Controlled**: pass the value prop (`sortState`/`sorting`, `searchValue`, `columnPinning`, `columnOrder`, `columnWidths`, `columnVisibility`, `columnHighlights`, `expandedRowIds`, `rowDetailStates`) and apply `on*Change` updates yourself.
- **Mixed** is fine: for example, control visibility from user preferences while leaving ordering and widths uncontrolled.

## Architecture notes

- **Div-based grid** (`role="table"`) instead of native `<table>`, because sticky pinned cells and absolute-positioned virtual rows are more reliable this way.
- **Windowing** uses fixed `rowHeight` and declared `expandedRowHeight` for predictable virtualization.
- **Pinning** preserves caller order and computes sticky offsets only from pinned predecessors or followers.
- **Layout state** is unified so order, pinning, widths, visibility and highlights can be serialized together.
- **Menus** render through `createPortal` into `document.body`.
- **Async details** use a per-row state machine with stale-response protection and success caching.
- **SSR** avoids browser globals at import time.

## Performance notes

- Only the visible window plus `overscan` rows is mounted.
- Keep `columns` and `data` referentially stable.
- `rowHeight` should match the visual row height.
- For very large datasets, prefer server-side filtering and sorting where needed.

## Accessibility notes

- `aria-sort`, `aria-expanded`, `aria-pressed`, labelled controls, focus rings, and keyboard interactions are supported.
- Resize handles are keyboard reachable.
- `aria-rowcount` and `aria-rowindex` describe the full dataset even when rows are virtualized.

## Known tradeoffs

- Fixed row and panel heights are still the default model.
- Pinned columns are not forced into one contiguous edge group.
- Drag reorder uses HTML5 drag and drop, so touch devices should prefer keyboard or menu movement.
- Search is not internally debounced.
- Stretch redistribution stays single-pass when `maxWidth` is hit.
- `role="table"` / `role="treegrid"` semantics are exposed, but full 2-D `role="grid"` keyboard navigation is not implemented yet.
- `TreeDataTable` renders parent-held values; it does not (yet) roll child values up into parents.
- During an active search, branches revealed because a descendant matches stay open until the search is cleared.

## Roadmap

Shipped in 0.3.0:
- `TreeDataTable` (children as a continuation of the table)
- `InfoTooltip` + per-column `infoTip`

Shipped in 0.2.1 (hardening — see [CHANGELOG](CHANGELOG.md)):
- real `AbortSignal` wiring for `loadRowDetails`
- NaN / Invalid-Date-safe sorting
- resize-drag cleanup, multi-sort click cycle, empty-state totals, menu/panel fixes

Shipped in 0.2.0:
- pin-in-place
- drag reorder
- column menu
- highlighting
- async row expansion
- visibility management
- layout persistence
- multi-sort
- density modes
- toolbar slots
- formatter helpers

Next candidates:
- parent value roll-up + group band rows for `TreeDataTable`
- `role="grid"` 2-D keyboard navigation
- row selection
- CSV/XLSX export helpers
- measured variable row heights
- column groups / multi-level headers
- server-driven data adapters
- touch-friendly drag reorder layer

## Local development

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run validate:exports
npm run demo:build
```

## Publish steps

```bash
npm version patch|minor|major
npm publish --access public
```

## License

MIT