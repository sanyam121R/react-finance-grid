import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "../src";
import { aggregateRows } from "../src/utils/aggregate";
import { getRowId, makeColumns, makeData } from "./helpers";

describe("grand total", () => {
  it("renders a sum total row with label", () => {
    render(
      <DataTable
        data={makeData(4)} // budgets 100+200+300+400 = 1000
        columns={makeColumns()}
        getRowId={getRowId}
        showGrandTotal
        grandTotalLabel="Total budget"
      />
    );
    const total = screen.getByTestId("rfg-grand-total");
    expect(within(total).getByText("Total budget")).toBeInTheDocument();
    expect(within(total).getByText("1,000")).toBeInTheDocument();
    expect(within(total).getByText("900")).toBeInTheDocument(); // actual sum
  });

  it("recomputes totals on the filtered set by default", () => {
    render(
      <DataTable
        data={makeData(4)}
        columns={makeColumns()}
        getRowId={getRowId}
        showSearch
        showGrandTotal
      />
    );
    fireEvent.change(screen.getByTestId("rfg-search"), {
      target: { value: "EMEA" }, // rows 0 and 2 -> 100+300
    });
    const total = screen.getByTestId("rfg-grand-total");
    expect(within(total).getByText("400")).toBeInTheDocument();
  });

  it('totalsScope="all" ignores filtering', () => {
    render(
      <DataTable
        data={makeData(4)}
        columns={makeColumns()}
        getRowId={getRowId}
        showSearch
        showGrandTotal
        totalsScope="all"
      />
    );
    fireEvent.change(screen.getByTestId("rfg-search"), {
      target: { value: "EMEA" },
    });
    const total = screen.getByTestId("rfg-grand-total");
    expect(within(total).getByText("1,000")).toBeInTheDocument();
  });

  it("supports custom formatter via renderTotal", () => {
    const cols = makeColumns();
    cols[2]!.renderTotal = (v) => `USD ${v}`;
    render(
      <DataTable
        data={makeData(2)}
        columns={cols}
        getRowId={getRowId}
        showGrandTotal
      />
    );
    expect(screen.getByText("USD 300")).toBeInTheDocument();
  });

  it("supports custom aggregate functions", () => {
    const cols = makeColumns();
    cols[3]!.aggregate = (rows) =>
      rows.reduce((s, r) => s + (r.budget - r.actual), 0); // variance total
    render(
      <DataTable
        data={makeData(2)} // (100-90)+(200-180)=30
        columns={cols}
        getRowId={getRowId}
        showGrandTotal
      />
    );
    const total = screen.getByTestId("rfg-grand-total");
    expect(within(total).getByText("30")).toBeInTheDocument();
  });

  it("aggregateRows supports avg/min/max/count and empty data", () => {
    const col = makeColumns()[2]!;
    const rows = makeData(4);
    expect(aggregateRows({ ...col, aggregate: "avg" }, rows)).toBe(250);
    expect(aggregateRows({ ...col, aggregate: "min" }, rows)).toBe(100);
    expect(aggregateRows({ ...col, aggregate: "max" }, rows)).toBe(400);
    expect(aggregateRows({ ...col, aggregate: "count" }, rows)).toBe(4);
    expect(aggregateRows({ ...col, aggregate: "sum" }, [])).toBeNull();
  });

  it("hides the total row while loading", () => {
    render(
      <DataTable
        data={makeData(4)}
        columns={makeColumns()}
        getRowId={getRowId}
        showGrandTotal
        isLoading
      />
    );
    expect(screen.queryByTestId("rfg-grand-total")).not.toBeInTheDocument();
  });
});