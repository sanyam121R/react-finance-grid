import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DataTable, TableSkeleton } from "../src";
import { getRowId, makeColumns, makeData } from "./helpers";

describe("SSR warnings", () => {
  it("renders menus/panels without useLayoutEffect warnings", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    renderToString(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        showSearch
        showColumnsPanel
        showGrandTotal
        multiSort
        density="compact"
        loadRowDetails={async () => ({})}
        renderExpandedRow={() => <div>panel</div>}
      />
    );
    const messages = warn.mock.calls.map((c) => String(c[0])).join("\n");
    expect(messages).not.toContain("useLayoutEffect");
    warn.mockRestore();
  });
});

describe("SSR safety", () => {
  it("imports without touching browser globals", () => {
    // forwardRef components are objects; both must be renderable
    expect(["function", "object"]).toContain(typeof DataTable);
    expect(typeof TableSkeleton).toBe("function");
  });

  it("renders to string on the server (table + totals + search)", () => {
    const html = renderToString(
      <DataTable
        data={makeData(10)}
        columns={makeColumns()}
        getRowId={getRowId}
        showSearch
        showGrandTotal
      />
    );
    expect(html).toContain("Department");
    expect(html).toContain("Engineering 0");
    expect(html).toContain("Grand total");
  });

  it("renders the skeleton to string", () => {
    const html = renderToString(<TableSkeleton rows={2} columns={3} />);
    expect(html).toContain("rfg-skeleton-bar");
  });
});