import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import {
  DataTable,
  InfoTooltip,
  TableSkeleton,
  TreeDataTable,
  createCurrencyFormatter,
  formatVariance,
  parseLayout,
  serializeLayout,
  type ColumnDef,
  type DataTableHandle,
  type Density,
  type GridLayoutState,
  type TreeColumnDef,
} from "../src";
import "../src/styles.css";
import {
  fetchQuarterDetails,
  fetchSubAccounts,
  makeDemoData,
  makeExpenseTree,
  makeMessyData,
  type DeptRow,
  type ExpenseAccount,
  type MessyRow,
  type QuarterDetail,
} from "./data";

const DATA = makeDemoData(5000);
const EXPENSES = makeExpenseTree();
const MESSY = makeMessyData();
const usd = createCurrencyFormatter({ currency: "USD", locale: "en-US" });

/* ================================================================== */
/* Shared columns (0.1.0 core set, reused by later tabs)               */
/* ================================================================== */

function makeDeptColumns(): ColumnDef<DeptRow>[] {
  return [
    {
      id: "department",
      header: "Department",
      accessorKey: "department",
      pin: "left", // v0.1.0 — pinned (sticky) column
      width: 170,
      hideable: false,
    },
    { id: "costCenter", header: "Cost center", accessorKey: "costCenter", width: 120 },
    { id: "owner", header: "Owner", accessorKey: "owner", width: 130 },
    { id: "region", header: "Region", accessorKey: "region", width: 100 },
    {
      id: "budget",
      header: "Budget",
      accessorKey: "budget",
      width: 140,
      aggregate: "sum",
      cell: (row) => usd(row.budget),
      renderTotal: (v) => usd(v),
    },
    {
      id: "actual",
      header: "Actual",
      accessorKey: "actual",
      width: 140,
      aggregate: "sum",
      cell: (row) => usd(row.actual),
      renderTotal: (v) => usd(v),
    },
    {
      id: "variance",
      header: "Variance",
      accessorKey: "variance",
      width: 140,
      aggregate: "sum",
      cell: (row) => (
        <span style={{ color: row.variance < 0 ? "#dc2626" : "#16a34a" }}>
          {formatVariance(row.variance, { currencyStyle: true, locale: "en-US" })}
        </span>
      ),
      renderTotal: (v) => usd(v),
    },
    {
      id: "utilisation",
      header: "Utilisation",
      accessorFn: (r) => r.actual / r.budget,
      width: 120,
      cell: (_row, value) => `${((value as number) * 100).toFixed(1)}%`,
      aggregate: (rows) =>
        rows.length === 0
          ? null
          : rows.reduce((s, r) => s + r.actual, 0) /
            rows.reduce((s, r) => s + r.budget, 0),
      renderTotal: (v) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      width: 130,
      pin: "right", // v0.1.0 — right-pinned column
    },
  ];
}

/* Nested grid rendered inside expanded rows. */
const quarterColumns: ColumnDef<QuarterDetail>[] = [
  { id: "quarter", header: "Quarter", accessorKey: "quarter", width: 110, menu: false },
  {
    id: "budget", header: "Budget", accessorKey: "budget", width: 130,
    cell: (q) => usd(q.budget), aggregate: "sum", renderTotal: (v) => usd(v), menu: false,
  },
  {
    id: "actual", header: "Actual", accessorKey: "actual", width: 130,
    cell: (q) => usd(q.actual), aggregate: "sum", renderTotal: (v) => usd(v), menu: false,
  },
];

/* ================================================================== */
/* Tab 1 — v0.1.0 · Core grid                                          */
/* ================================================================== */

function CoreDemo() {
  const [loading, setLoading] = useState(false);
  const columns = useMemo(makeDeptColumns, []);

  return (
    <section>
      <FeatureList
        version="0.1.0"
        items={[
          "Windowed rendering — 5,000 rows, only the visible slice is mounted",
          "Pinned (sticky) columns left and right with correct offsets + edge shadows",
          "Header sorting (asc → desc → off) with a smart default comparator",
          "Global search, drag/keyboard column resizing, stretch columns",
          "Sticky grand-total row (sum/avg/min/max/count/custom)",
          "Expandable rows (sync) — here with a nested DataTable per row",
          "Skeleton loading matching the real column structure",
        ]}
      />
      <label style={{ fontSize: 13 }}>
        <input
          type="checkbox"
          checked={loading}
          onChange={(e) => setLoading(e.target.checked)}
          data-testid="toggle-loading"
        />{" "}
        Skeleton loading
      </label>
      <div style={{ height: 8 }} />
      <DataTable<DeptRow>
        data={DATA}
        columns={columns}
        getRowId={(r) => r.id}
        height={480}
        isLoading={loading}
        showSearch
        showGrandTotal
        grandTotalLabel="Grand total"
        /* restrict to the 0.1.0 feature surface */
        enableColumnMenu={false}
        enableColumnReorder={false}
        expandedRowHeight={280}
        renderExpandedRow={({ row, collapse }) => (
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <strong>{row.department}</strong>
              <span style={{ color: "#64748b" }}>
                quarterly breakdown (synchronous — data already on the row)
              </span>
              <button type="button" onClick={collapse}>Close</button>
            </div>
            <div style={{ height: 8 }} />
            <DataTable<QuarterDetail>
              data={row.quarters}
              columns={quarterColumns}
              getRowId={(q) => q.quarter}
              height={190}
              density="compact"
              showGrandTotal
              grandTotalLabel="FY total"
              enableColumnMenu={false}
              enableColumnReorder={false}
              disableVirtualization
            />
          </div>
        )}
      />
    </section>
  );
}

/* ================================================================== */
/* Tab 2 — v0.2.0 · Power columns                                      */
/* ================================================================== */

const LAYOUT_KEY = "rfg-demo-layout";
const loadSavedLayout = (): GridLayoutState | null => {
  try {
    return parseLayout(sessionStorage.getItem(LAYOUT_KEY));
  } catch {
    return null;
  }
};

function PowerDemo() {
  const gridRef = useRef<DataTableHandle>(null);
  const [density, setDensity] = useState<Density>("comfortable");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [failRate, setFailRate] = useState(0.2);
  const columns = useMemo(() => {
    const cols = makeDeptColumns();
    cols.find((c) => c.id === "budget")!.highlight = "blue"; // initial highlight
    return cols;
  }, []);

  const onLayoutChange = useCallback((layout: GridLayoutState) => {
    sessionStorage.setItem(LAYOUT_KEY, serializeLayout(layout));
    setSavedAt(new Date().toLocaleTimeString());
  }, []);

  return (
    <section>
      <FeatureList
        version="0.2.0"
        items={[
          "Drag the grip (⠿) or press ←/→ on it to reorder columns",
          "Per-column ⋮ menu — sort, pin in place, move, hide, reset width, highlight",
          "Pin in place: pinning never moves a column; position is owned by the order",
          "Multi-sort — shift-click sort buttons or use “Add … to sort” in the menu",
          "Columns panel (visibility), density presets, toolbar slots",
          "Async row expansion — per-row loading/error/retry with simulated failures",
          "Layout persistence — order/pin/width/visibility/highlight/sorting → sessionStorage",
        ]}
      />
      <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
        <label>
          Density{" "}
          <select value={density} onChange={(e) => setDensity(e.target.value as Density)}>
            <option value="compact">compact</option>
            <option value="comfortable">comfortable</option>
            <option value="spacious">spacious</option>
          </select>
        </label>
        <label>
          Detail failure rate{" "}
          <select value={failRate} onChange={(e) => setFailRate(Number(e.target.value))}>
            <option value={0}>0% (always succeed)</option>
            <option value={0.2}>20%</option>
            <option value={1}>100% (always fail)</option>
          </select>
        </label>
        <button type="button" onClick={() => gridRef.current?.resetLayout()}>
          Reset layout
        </button>
        <button
          type="button"
          onClick={() => {
            const layout = gridRef.current?.serializeLayout();
            if (layout) console.log("layout snapshot", layout);
          }}
        >
          Log layout snapshot
        </button>
        <span style={{ color: "#64748b" }}>
          {savedAt ? `layout saved ${savedAt}` : "layout unchanged"}
        </span>
      </div>
      <div style={{ height: 8 }} />
      <DataTable<DeptRow, QuarterDetail[]>
        ref={gridRef}
        data={DATA}
        columns={columns}
        getRowId={(r) => r.id}
        height={480}
        density={density}
        showSearch
        showColumnsPanel
        multiSort
        showGrandTotal
        grandTotalLabel="Grand total"
        totalsScope="filtered"
        defaultLayout={loadSavedLayout()}
        onLayoutChange={onLayoutChange}
        expandedRowHeight={280}
        loadRowDetails={(row, _id, ctx) =>
          fetchQuarterDetails(row, { signal: ctx.signal, failRate })
        }
        renderExpandedRow={({ row, detail, reload, collapse }) => (
          <div data-testid={`panel-${row.id}`}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <strong>{row.department}</strong>
              <span style={{ color: "#64748b" }}>
                {row.costCenter} · {row.owner} · quarterly breakdown (fetched)
              </span>
              <button type="button" onClick={reload}>Reload</button>
              <button type="button" onClick={collapse}>Close</button>
            </div>
            <div style={{ height: 8 }} />
            <DataTable<QuarterDetail>
              data={detail.data ?? []}
              columns={quarterColumns}
              getRowId={(q) => q.quarter}
              height={190}
              density="compact"
              showGrandTotal
              grandTotalLabel="FY total"
              enableColumnReorder={false}
              disableVirtualization
            />
          </div>
        )}
        toolbarEnd={
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {DATA.length.toLocaleString()} rows · shift-click a sort button for multi-sort
          </span>
        }
      />
    </section>
  );
}

/* ================================================================== */
/* Tab 3 — v0.2.1 · Hardening (the fixes, demonstrated live)           */
/* ================================================================== */

const messyColumns: ColumnDef<MessyRow>[] = [
  { id: "account", header: "Account", accessorKey: "account", width: 240 },
  {
    id: "amount",
    header: "Amount",
    accessorKey: "amount",
    width: 160,
    align: "right",
    aggregate: "sum",
    cell: (row) =>
      row.amount === null || Number.isNaN(row.amount) ? (
        <span style={{ color: "#94a3b8" }}>—</span>
      ) : (
        usd(row.amount)
      ),
    renderTotal: (v) => usd(v),
  },
];

function HardeningDemo() {
  const [abortCount, setAbortCount] = useState(0);
  const deptColumns = useMemo(makeDeptColumns, []);

  return (
    <section>
      <FeatureList
        version="0.2.1"
        items={[
          "Sorting with NaN / null values: missing values sort last and neighbours stay ordered (previously a single NaN left surrounding rows unsorted)",
          "loadRowDetails now really receives { signal }: press Reload while a fetch is pending — the superseded request is aborted (counter below)",
          "Grand total hides under empty / no-results states",
          "Plain-clicking a column inside a multi-sort chain continues its asc → desc → off cycle",
          "Columns panel stays open while toggling visibility; resize drags clean up on unmount",
        ]}
      />

      <h3 style={{ fontSize: 14 }}>NaN-safe sorting</h3>
      <p style={{ fontSize: 13, color: "#475569" }}>
        Sort “Amount” — rows with failed feeds (NaN) or unposted values (null)
        always group at the bottom, and the numeric rows stay correctly ordered.
      </p>
      <DataTable<MessyRow>
        data={MESSY}
        columns={messyColumns}
        getRowId={(r) => r.id}
        height={320}
        disableVirtualization
        showGrandTotal
        grandTotalLabel="Posted total"
        enableColumnReorder={false}
      />

      <h3 style={{ fontSize: 14, marginTop: 24 }}>
        Abortable detail requests{" "}
        <span style={{ fontWeight: 400, color: "#64748b" }}>
          (aborted so far: <strong data-testid="abort-count">{abortCount}</strong>)
        </span>
      </h3>
      <p style={{ fontSize: 13, color: "#475569" }}>
        Expand a row, then press <em>Reload</em> while it is still loading: the
        in-flight request is aborted via <code>ctx.signal</code> before the new
        one starts.
      </p>
      <DataTable<DeptRow, QuarterDetail[]>
        data={DATA.slice(0, 50)}
        columns={deptColumns}
        getRowId={(r) => r.id}
        height={320}
        enableColumnReorder={false}
        expandedRowHeight={120}
        loadRowDetails={(row, _id, ctx) =>
          fetchQuarterDetails(row, {
            signal: ctx.signal,
            failRate: 0,
            delayMs: 2500,
            onAbort: () => setAbortCount((n) => n + 1),
          })
        }
        renderExpandedRow={({ detail, reload, collapse }) => (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span>
              {detail.data
                ? `${detail.data.length} quarters loaded`
                : "loading…"}
            </span>
            <button type="button" onClick={reload}>Reload</button>
            <button type="button" onClick={collapse}>Close</button>
          </div>
        )}
        renderDetailLoading={({ reload, collapse }) => (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span>Fetching quarters (slow request — 2.5s)…</span>
            <button type="button" onClick={reload}>
              Reload (aborts the pending request)
            </button>
            <button type="button" onClick={collapse}>Close</button>
          </div>
        )}
      />
    </section>
  );
}

/* ================================================================== */
/* Tab 4 — v0.3.0 · TreeDataTable + InfoTooltip                        */
/* ================================================================== */

const treeColumns: TreeColumnDef<ExpenseAccount>[] = [
  {
    id: "account",
    header: "Account",
    accessorFn: (r) => (r.code ? `${r.code}  ${r.name}` : r.name),
    width: 320,
    hideable: false,
    /* "View Details ›" teaser — only rows flagged with hasDetails get the ⓘ */
    infoTip: (row) =>
      row.hasDetails ? (
        <div style={{ maxWidth: 230 }}>
          You can take a look at the comprehensive details of this account by
          clicking “View Details”.
          <div style={{ marginTop: 6 }}>
            <a href={`#/accounts/${row.id}`}>View Details ›</a>
          </div>
        </div>
      ) : null,
    infoTipLabel: "Account details",
  },
  {
    id: "fy2025",
    header: "FY 2025",
    accessorKey: "fy2025",
    width: 150,
    align: "right",
    aggregate: "sum",
    cell: (r) => usd(r.fy2025),
    renderTotal: (v) => usd(v),
    /* per-region breakdown — like the design's India/UK/US/… tooltip */
    infoTip: (row) =>
      row.regionBreakdown ? (
        <table style={{ borderSpacing: "0 2px" }}>
          <tbody>
            {row.regionBreakdown.map((r) => (
              <tr key={r.region}>
                <td style={{ paddingRight: 24 }}>{r.region}</td>
                <td style={{ textAlign: "right" }}>{usd(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null,
    infoTipLabel: "Regional breakdown",
  },
  {
    id: "fy2024",
    header: "FY 2024",
    accessorKey: "fy2024",
    width: 150,
    align: "right",
    aggregate: "sum",
    cell: (r) => usd(r.fy2024),
    renderTotal: (v) => usd(v),
  },
  {
    id: "yoy",
    header: "YoY",
    accessorFn: (r) => r.fy2025 - r.fy2024,
    width: 150,
    align: "right",
    aggregate: (rows) => rows.reduce((s, r) => s + (r.fy2025 - r.fy2024), 0),
    cell: (_row, v) => (
      <span style={{ color: (v as number) < 0 ? "#16a34a" : "#dc2626" }}>
        {formatVariance(v as number, { currencyStyle: true, locale: "en-US" })}
      </span>
    ),
    renderTotal: (v) =>
      v === null ? "—" : formatVariance(v, { currencyStyle: true, locale: "en-US" }),
  },
];

function TreeDemo() {
  const [async_, setAsync] = useState(false);
  const [failRate, setFailRate] = useState(0.2);

  return (
    <section>
      <FeatureList
        version="0.3.0"
        items={[
          "Expansion is a continuation of the table: children render under the SAME column headings, indented, with the chevron inline in the tree column",
          "ⓘ info tooltips per cell — hover/focus the icons on “Benefits Expense” (View Details ›) and on “Certification Expenses” FY 2025 (regional breakdown)",
          "Sorting sorts every sibling group independently — subtrees never tear apart",
          "Tree-aware search — try “certification”: the parent chain stays and the match is revealed",
          "Grand total (“Total Expenses”) aggregates root accounts only — expanding never double-counts",
          "Async children with inline loading/error rows, retry, caching and AbortSignal",
        ]}
      />
      <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
        <label>
          <input
            type="checkbox"
            checked={async_}
            onChange={(e) => setAsync(e.target.checked)}
            data-testid="toggle-async-children"
          />{" "}
          Load children asynchronously
        </label>
        {async_ && (
          <label>
            Children failure rate{" "}
            <select value={failRate} onChange={(e) => setFailRate(Number(e.target.value))}>
              <option value={0}>0%</option>
              <option value={0.2}>20%</option>
              <option value={1}>100% (always fail → inline retry row)</option>
            </select>
          </label>
        )}
      </div>
      <div style={{ height: 8 }} />
      <TreeDataTable<ExpenseAccount>
        key={async_ ? "async" : "sync"} /* remount when switching modes */
        data={EXPENSES}
        columns={treeColumns}
        getRowId={(r) => r.id}
        height={480}
        showSearch
        showColumnsPanel
        multiSort
        showGrandTotal
        grandTotalLabel="Total Expenses"
        defaultExpandedRowIds={new Set(["benefits"])}
        getRowChildren={async_ ? undefined : (r) => r.children}
        loadRowChildren={
          async_
            ? (row, _id, ctx) => fetchSubAccounts(row, { signal: ctx.signal, failRate })
            : undefined
        }
        getRowCanExpand={
          async_ ? (r) => (r.children?.length ?? 0) > 0 : undefined
        }
        toolbarEnd={
          <span style={{ fontSize: 12, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}>
            Standalone tooltip example
            <InfoTooltip
              content={
                <div style={{ maxWidth: 220 }}>
                  <strong>InfoTooltip</strong> is exported on its own — use it in
                  DataTable cells, toolbars or anywhere else.
                </div>
              }
              label="About InfoTooltip"
            />
          </span>
        }
      />
    </section>
  );
}

/* ================================================================== */
/* Shell                                                               */
/* ================================================================== */

function FeatureList({ version, items }: { version: string; items: string[] }) {
  return (
    <div style={{ margin: "8px 0 14px" }}>
      <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>
        What shipped in <code>v{version}</code>
      </h2>
      <ul style={{ fontSize: 13, color: "#475569", margin: 0, paddingLeft: 18, maxWidth: 900 }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

const TABS = [
  { id: "v0.1.0", label: "0.1.0 · Core grid" },
  { id: "v0.2.0", label: "0.2.0 · Power columns" },
  { id: "v0.2.1", label: "0.2.1 · Hardening" },
  { id: "v0.3.0", label: "0.3.0 · Tree + tooltips" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function App() {
  const [tab, setTab] = useState<TabId>("v0.3.0");

  return (
    <div style={{ padding: 24, maxWidth: 1180, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>react-finance-grid — demo</h1>
      <p style={{ fontSize: 13, color: "#475569", margin: "0 0 14px" }}>
        One tab per release — each tab is a live, self-contained illustration of
        what that version added.
      </p>

      <div role="tablist" aria-label="Demo versions" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid " + (tab === t.id ? "#2563eb" : "#e2e8f0"),
              background: tab === t.id ? "#eff6ff" : "#fff",
              color: tab === t.id ? "#1d4ed8" : "#334155",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Suspense fallback={<TableSkeleton rows={10} columns={6} height={480} />}>
        {tab === "v0.1.0" && <CoreDemo />}
        {tab === "v0.2.0" && <PowerDemo />}
        {tab === "v0.2.1" && <HardeningDemo />}
        {tab === "v0.3.0" && <TreeDemo />}
      </Suspense>
    </div>
  );
}