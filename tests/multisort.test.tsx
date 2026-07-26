// bunx vitest run tests/multisort.test.tsx tests/extras.test.tsx 2>&1 | tail -22
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type ColumnDef, type SortState } from "../src";
import { cycleMultiSort, addSort, removeSort } from "../src/utils/sorting";
import { getRowId, type Dept } from "./helpers";

/** region repeats so a second sort key is observable. */
function data(): Dept[] {
  return [
    { id: "a", name: "Alpha", region: "EMEA", budget: 300, actual: 10 },
    { id: "b", name: "Bravo", region: "APAC", budget: 100, actual: 20 },
    { id: "c", name: "Gamma", region: "EMEA", budget: 100, actual: 30 },
    { id: "d", name: "Delta", region: "APAC", budget: 300, actual: 40 },
  ];
}

const cols: ColumnDef<Dept>[] = [
  { id: "region", header: "Region", accessorKey: "region", width: 120 },
  { id: "budget", header: "Budget", accessorKey: "budget", width: 120 },
  { id: "name", header: "Name", accessorKey: "name", width: 140 },
];

function rowNames(): string[] {
  return Array.from(document.querySelectorAll(".rfg-body .rfg-row")).map(
    (r) => (r.querySelector('[data-column-id="name"] .rfg-cell-content') as HTMLElement).textContent!
  );
}

describe("multi-sort", () => {
  it("adds a second sort key with shift+click and shows sort indexes", () => {
    render(
      <DataTable data={data()} columns={cols} getRowId={getRowId} multiSort />
    );
    fireEvent.click(screen.getByTestId("sort-region")); // region asc
    fireEvent.click(screen.getByTestId("sort-budget"), { shiftKey: true }); // + budget asc

    // APAC(100 Bravo, 300 Delta) then EMEA(100 Gamma, 300 Alpha)
    expect(rowNames()).toEqual(["Bravo", "Delta", "Gamma", "Alpha"]);
    const regionHeader = document.querySelector(
      '.rfg-header [data-column-id="region"]'
    ) as HTMLElement;
    const budgetHeader = document.querySelector(
      '.rfg-header [data-column-id="budget"]'
    ) as HTMLElement;
    expect(regionHeader).toHaveAttribute("aria-sort", "ascending");
    expect(budgetHeader).toHaveAttribute("aria-sort", "ascending");
    expect(regionHeader.querySelector(".rfg-sort-index")!.textContent).toBe("1");
    expect(budgetHeader.querySelector(".rfg-sort-index")!.textContent).toBe("2");
  });

  it("shift+click cycles asc -> desc -> removed within the chain", () => {
    render(
      <DataTable data={data()} columns={cols} getRowId={getRowId} multiSort />
    );
    fireEvent.click(screen.getByTestId("sort-region"));
    fireEvent.click(screen.getByTestId("sort-budget"), { shiftKey: true }); // asc
    fireEvent.click(screen.getByTestId("sort-budget"), { shiftKey: true }); // desc
    expect(rowNames()).toEqual(["Delta", "Bravo", "Alpha", "Gamma"]);

    fireEvent.click(screen.getByTestId("sort-budget"), { shiftKey: true }); // removed
    const budgetHeader = document.querySelector(
      '.rfg-header [data-column-id="budget"]'
    ) as HTMLElement;
    expect(budgetHeader).toHaveAttribute("aria-sort", "none");
  });

  it("plain click resets to a single sort", () => {
    render(
      <DataTable data={data()} columns={cols} getRowId={getRowId} multiSort />
    );
    fireEvent.click(screen.getByTestId("sort-region"));
    fireEvent.click(screen.getByTestId("sort-budget"), { shiftKey: true });
    fireEvent.click(screen.getByTestId("sort-name")); // single
    const regionHeader = document.querySelector(
      '.rfg-header [data-column-id="region"]'
    ) as HTMLElement;
    expect(regionHeader).toHaveAttribute("aria-sort", "none");
    expect(rowNames()).toEqual(["Alpha", "Bravo", "Delta", "Gamma"]);
  });

  it("menu 'add to sort' actions build the chain", () => {
    render(
      <DataTable data={data()} columns={cols} getRowId={getRowId} multiSort />
    );
    fireEvent.click(screen.getByTestId("menu-region"));
    fireEvent.click(screen.getByTestId("menu-item-sort-add-asc-region"));
    fireEvent.click(screen.getByTestId("menu-budget"));
    fireEvent.click(screen.getByTestId("menu-item-sort-add-desc-budget"));
    expect(rowNames()).toEqual(["Delta", "Bravo", "Alpha", "Gamma"]);
  });

  it("hides add-to-sort actions when multiSort is off and keeps single-sort cycle", () => {
    render(<DataTable data={data()} columns={cols} getRowId={getRowId} />);
    fireEvent.click(screen.getByTestId("menu-region"));
    expect(
      screen.queryByTestId("menu-item-sort-add-asc-region")
    ).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId("column-menu-region"), { key: "Escape" });

    fireEvent.click(screen.getByTestId("sort-region"));
    fireEvent.click(screen.getByTestId("sort-budget"), { shiftKey: true }); // no multi
    const regionHeader = document.querySelector(
      '.rfg-header [data-column-id="region"]'
    ) as HTMLElement;
    expect(regionHeader).toHaveAttribute("aria-sort", "none");
  });

  it("supports controlled multi-sort via sorting/onSortingChange", () => {
    const onSortingChange = vi.fn();
    const sorting: SortState[] = [
      { columnId: "region", direction: "asc" },
      { columnId: "budget", direction: "desc" },
    ];
    const { rerender } = render(
      <DataTable
        data={data()}
        columns={cols}
        getRowId={getRowId}
        multiSort
        sorting={sorting}
        onSortingChange={onSortingChange}
      />
    );
    expect(rowNames()).toEqual(["Delta", "Bravo", "Alpha", "Gamma"]);

    fireEvent.click(screen.getByTestId("sort-name"), { shiftKey: true });
    expect(onSortingChange).toHaveBeenCalledWith([
      ...sorting,
      { columnId: "name", direction: "asc" },
    ]);

    rerender(
      <DataTable
        data={data()}
        columns={cols}
        getRowId={getRowId}
        multiSort
        sorting={[{ columnId: "name", direction: "desc" }]}
        onSortingChange={onSortingChange}
      />
    );
    expect(rowNames()).toEqual(["Gamma", "Delta", "Bravo", "Alpha"]);
  });

  it("defaultSorting seeds uncontrolled multi-sort", () => {
    render(
      <DataTable
        data={data()}
        columns={cols}
        getRowId={getRowId}
        multiSort
        defaultSorting={[
          { columnId: "region", direction: "desc" },
          { columnId: "name", direction: "asc" },
        ]}
      />
    );
    expect(rowNames()).toEqual(["Alpha", "Gamma", "Bravo", "Delta"]);
  });

  it("sorting helpers are exported and pure", () => {
    expect(cycleMultiSort([], "a")).toEqual([{ columnId: "a", direction: "asc" }]);
    expect(cycleMultiSort([{ columnId: "a", direction: "asc" }], "a")).toEqual([
      { columnId: "a", direction: "desc" },
    ]);
    expect(cycleMultiSort([{ columnId: "a", direction: "desc" }], "a")).toEqual([]);
    expect(addSort([{ columnId: "a", direction: "asc" }], "a", "desc")).toEqual([
      { columnId: "a", direction: "desc" },
    ]);
    expect(removeSort([{ columnId: "a", direction: "asc" }], "a")).toEqual([]);
  });
});