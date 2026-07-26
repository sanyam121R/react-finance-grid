import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable, TableSkeleton } from "../src";
import { getRowId, makeColumns, makeData } from "./helpers";

describe("SSR safety", () => {
  it("imports without touching browser globals", () => {
    // expect(typeof window).toBe("undefined");
    expect(typeof DataTable).toBe("function");
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