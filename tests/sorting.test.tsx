import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type SortState } from "../src";
import { defaultCompare } from "../src/utils/compare";
import { getRowId, makeColumns, makeData, type Dept } from "./helpers";

function firstRowName(): string {
  const rows = screen.getAllByRole("row").filter((r) => r.className.includes("rfg-row"));
  return rows[0]!.querySelector(".rfg-cell-content")!.textContent ?? "";
}

describe("sorting", () => {
  it("cycles asc -> desc -> off from the header button", () => {
    render(
      <DataTable data={makeData(4)} columns={makeColumns()} getRowId={getRowId} />
    );
    const btn = screen.getByTestId("sort-budget");
    const header = screen.getByRole("columnheader", { name: /Budget/ });

    fireEvent.click(btn); // asc
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(firstRowName()).toBe("Engineering 0"); // budget 100 lowest

    fireEvent.click(btn); // desc
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(firstRowName()).toBe("Finance 3"); // budget 400 highest

    fireEvent.click(btn); // off
    expect(header).toHaveAttribute("aria-sort", "none");
    expect(firstRowName()).toBe("Engineering 0"); // original order
  });

  it("respects a custom sortFn", () => {
    const cols = makeColumns();
    cols[0]!.sortFn = (a: Dept, b: Dept) => a.region.localeCompare(b.region);
    render(<DataTable data={makeData(4)} columns={cols} getRowId={getRowId} />);
    fireEvent.click(screen.getByTestId("sort-name"));
    // APAC rows (odd indexes) come first
    expect(firstRowName()).toBe("Marketing 1");
  });

  it("supports controlled sorting", () => {
    const onSortStateChange = vi.fn();
    const { rerender } = render(
      <DataTable
        data={makeData(4)}
        columns={makeColumns()}
        getRowId={getRowId}
        sortState={null}
        onSortStateChange={onSortStateChange}
      />
    );
    fireEvent.click(screen.getByTestId("sort-budget"));
    expect(onSortStateChange).toHaveBeenCalledWith({
      columnId: "budget",
      direction: "asc",
    });
    // controlled: no change until the parent passes new state
    expect(firstRowName()).toBe("Engineering 0");

    const sort: SortState = { columnId: "budget", direction: "desc" };
    rerender(
      <DataTable
        data={makeData(4)}
        columns={makeColumns()}
        getRowId={getRowId}
        sortState={sort}
        onSortStateChange={onSortStateChange}
      />
    );
    expect(firstRowName()).toBe("Finance 3");
  });

  it("applies defaultSortState in uncontrolled mode", () => {
    render(
      <DataTable
        data={makeData(4)}
        columns={makeColumns()}
        getRowId={getRowId}
        defaultSortState={{ columnId: "budget", direction: "desc" }}
      />
    );
    expect(firstRowName()).toBe("Finance 3");
  });

  it("defaultCompare handles numbers, strings, dates and nulls", () => {
    expect(defaultCompare(1, 2)).toBeLessThan(0);
    expect(defaultCompare("a10", "a2")).toBeGreaterThan(0); // numeric-aware
    expect(
      defaultCompare(new Date("2024-01-01"), new Date("2025-01-01"))
    ).toBeLessThan(0);
    expect(defaultCompare(null, 5)).toBeGreaterThan(0); // nulls last
    expect(defaultCompare(5, undefined)).toBeLessThan(0);
  });
});