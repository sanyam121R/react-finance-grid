import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable, TableSkeleton } from "../src";
import { getRowId, makeColumns, makeData } from "./helpers";

describe("rendering", () => {
  it("renders headers and cells", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    expect(screen.getByText("Department")).toBeInTheDocument();
    expect(screen.getByText("Budget")).toBeInTheDocument();
    expect(screen.getByText("Engineering 0")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument(); // budget of row 2
  });

  it("uses accessorFn when provided", () => {
    render(
      <DataTable data={makeData(1)} columns={makeColumns()} getRowId={getRowId} />
    );
    expect(screen.getByText("90")).toBeInTheDocument(); // actual via accessorFn
  });

  it("supports header render functions", () => {
    const cols = makeColumns();
    cols[0]!.header = (ctx) => <em>custom-{ctx.column.id}</em>;
    render(<DataTable data={makeData(1)} columns={cols} getRowId={getRowId} />);
    expect(screen.getByText("custom-name")).toBeInTheDocument();
  });

  it("supports custom cell renderers receiving row and value", () => {
    const cols = makeColumns();
    cols[2]!.cell = (_row, value) => <strong>${String(value)}</strong>;
    render(<DataTable data={makeData(1)} columns={cols} getRowId={getRowId} />);
    expect(screen.getByText("$100")).toBeInTheDocument();
  });

  it("shows empty message when no rows", () => {
    render(
      <DataTable
        data={[]}
        columns={makeColumns()}
        getRowId={getRowId}
        emptyMessage="Nothing here"
      />
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders skeleton rows when isLoading", () => {
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        isLoading
        skeletonRowCount={4}
      />
    );
    expect(screen.getByTestId("rfg-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Engineering 0")).not.toBeInTheDocument();
    expect(screen.getByTestId("rfg-scroll")).toHaveAttribute("aria-busy", "true");
  });

  it("exports a standalone TableSkeleton for Suspense fallbacks", () => {
    render(<TableSkeleton rows={3} columns={4} />);
    expect(screen.getByTestId("rfg-table-skeleton")).toBeInTheDocument();
  });

  it("exposes table semantics and aria counts", () => {
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        ariaLabel="Budgets"
      />
    );
    const table = screen.getByRole("table", { name: "Budgets" });
    expect(table).toHaveAttribute("aria-rowcount", "4"); // 3 data + header
    expect(table).toHaveAttribute("aria-colcount", "4");
  });
});