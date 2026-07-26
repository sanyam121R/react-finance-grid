import { StrictMode, Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import { DataTable, TableSkeleton, type ColumnDef } from "../src";
import '../src/styles.css';
import { makeDemoData, usd, type DeptRow, type QuarterDetail } from "./data";

const DATA = makeDemoData(5000);

const money = (
  key: "budget" | "actual" | "variance",
  header: string
): ColumnDef<DeptRow> => ({
  id: key,
  header,
  accessorKey: key,
  align: "right",
  width: 140,
  aggregate: "sum",
  cell: (row) =>
    key === "variance" ? (
      <span style={{ color: row.variance < 0 ? "#dc2626" : "#16a34a" }}>
        {usd(row.variance)}
      </span>
    ) : (
      usd(row[key])
    ),
  renderTotal: (v) => (v === null ? "—" : usd(v)),
});

const columns: ColumnDef<DeptRow>[] = [
  { id: "department", header: "Department", accessorKey: "department", pin: "left", width: 170 },
  { id: "costCenter", header: "Cost center", accessorKey: "costCenter", width: 120 },
  { id: "owner", header: "Owner", accessorKey: "owner", width: 130 },
  { id: "region", header: "Region", accessorKey: "region", width: 100 },
  money("budget", "Budget"),
  money("actual", "Actual"),
  money("variance", "Variance"),
  { id: "status", header: "Status", accessorKey: "status", width: 130, pin: "right" },
];

/* Nested grid inside the expanded panel — per-quarter breakdown. */
const quarterColumns: ColumnDef<QuarterDetail>[] = [
  { id: "quarter", header: "Quarter", accessorKey: "quarter", width: 110, pinnable: false },
  {
    id: "budget", header: "Budget", accessorKey: "budget", align: "right",
    cell: (q) => usd(q.budget), aggregate: "sum", renderTotal: (v) => (v === null ? "—" : usd(v)),
    pinnable: false,
  },
  {
    id: "actual", header: "Actual", accessorKey: "actual", align: "right",
    cell: (q) => usd(q.actual), aggregate: "sum", renderTotal: (v) => (v === null ? "—" : usd(v)),
    pinnable: false,
  },
];

function App() {
  const [loading, setLoading] = useState(false);
  return (
    <div style={{ padding: 24, maxWidth: 1150, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22 }}>react-finance-grid — demo (5,000 rows)</h1>
      <label style={{ fontSize: 13 }}>
        <input
          type="checkbox"
          checked={loading}
          onChange={(e) => setLoading(e.target.checked)}
          data-testid="toggle-loading"
        />{" "}
        Simulate loading (skeleton)
      </label>
      <div style={{ height: 12 }} />

      <Suspense fallback={<TableSkeleton rows={10} columns={8} height={520} />}>
        <DataTable<DeptRow>
          data={DATA}
          columns={columns}
          getRowId={(r) => r.id}
          height={520}
          isLoading={loading}
          showSearch
          showGrandTotal
          grandTotalLabel="Grand total"
          expandedRowHeight={260}
          renderExpandedRow={({ row }) => (
            <div data-testid={`panel-${row.id}`}>
              <strong>{row.department}</strong> · {row.costCenter} · {row.owner} — quarterly breakdown
              <div style={{ height: 8 }} />
              <DataTable<QuarterDetail>
                data={row.quarters}
                columns={quarterColumns}
                getRowId={(q) => q.quarter}
                height={190}
                rowHeight={36}
                showGrandTotal
                grandTotalLabel="FY total"
                disableVirtualization
              />
            </div>
          )}
          onRowExpand={(row) => {
            // Future async extension point — may return a Promise.
            console.log("expanded:", row.id);
          }}
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