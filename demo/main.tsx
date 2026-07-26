import { StrictMode, Suspense, useCallback, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DataTable,
  TableSkeleton,
  createCurrencyFormatter,
  formatVariance,
  parseLayout,
  serializeLayout,
  type ColumnDef,
  type DataTableHandle,
  type Density,
  type GridLayoutState,
} from "../src";
import "../src/styles.css";
import {
  makeDemoData,
  fetchQuarterDetails,
  type DeptRow,
  type QuarterDetail,
} from "./data";

const DATA = makeDemoData(5000);
const usd = createCurrencyFormatter({ currency: "USD", locale: "en-US" });

/* A tiny storage-agnostic persistence layer (sessionStorage here — could be an
   API call, IndexedDB, user prefs service…). */
const LAYOUT_KEY = "rfg-demo-layout";
const loadSavedLayout = (): GridLayoutState | null => {
  try {
    return parseLayout(sessionStorage.getItem(LAYOUT_KEY));
  } catch {
    return null;
  }
};

const columns: ColumnDef<DeptRow>[] = [
  {
    id: "department",
    header: "Department",
    accessorKey: "department",
    pin: "left", // pinned in place — stays at position 1
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
    highlight: "blue", // initial highlight
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
    pin: "right", // pinned in place at the right edge
  },
];

/* Nested grid inside an expanded row — fed by the async loader. */
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

function App() {
  const gridRef = useRef<DataTableHandle>(null);
  const [loading, setLoading] = useState(false);
  const [density, setDensity] = useState<Density>("comfortable");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [failRate, setFailRate] = useState(0.2);

  const onLayoutChange = useCallback((layout: GridLayoutState) => {
    sessionStorage.setItem(LAYOUT_KEY, serializeLayout(layout));
    setSavedAt(new Date().toLocaleTimeString());
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1180, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22 }}>react-finance-grid — demo (5,000 rows)</h1>
      <p style={{ fontSize: 13, color: "#475569", maxWidth: 860 }}>
        Drag the grip (⠿) to reorder · use a column's ⋮ menu to sort, pin in place,
        move, hide, reset width or highlight · expand a row to trigger an async
        detail fetch (with retry) · layout changes are persisted to
        sessionStorage.
      </p>

      <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
        <label>
          <input
            type="checkbox"
            checked={loading}
            onChange={(e) => setLoading(e.target.checked)}
            data-testid="toggle-loading"
          />{" "}
          Skeleton loading
        </label>
        <label>
          Density{" "}
          <select
            value={density}
            onChange={(e) => setDensity(e.target.value as Density)}
          >
            <option value="compact">compact</option>
            <option value="comfortable">comfortable</option>
            <option value="spacious">spacious</option>
          </select>
        </label>
        <label>
          Detail failure rate{" "}
          <select
            value={failRate}
            onChange={(e) => setFailRate(Number(e.target.value))}
          >
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

      <div style={{ height: 12 }} />

      <Suspense fallback={<TableSkeleton rows={10} columns={9} height={520} />}>
        <DataTable<DeptRow, QuarterDetail[]>
          ref={gridRef}
          data={DATA}
          columns={columns}
          getRowId={(r) => r.id}
          height={520}
          density={density}
          isLoading={loading}
          showSearch
          showColumnsPanel
          multiSort
          showGrandTotal
          grandTotalLabel="Grand total"
          totalsScope="filtered"
          defaultLayout={loadSavedLayout()}
          onLayoutChange={onLayoutChange}
          expandedRowHeight={280}
          /* async row expansion */
          loadRowDetails={(row) => fetchQuarterDetails(row, failRate)}
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
              {DATA.length.toLocaleString()} rows · shift-click a sort button for
              multi-sort
            </span>
          }
        />
      </Suspense>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);