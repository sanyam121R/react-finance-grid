// bunx vitest run tests/menu.test.tsx --reporter=verbose 2>&1 | grep -E "✓|×|✗" | head -15; sed -n 120,132p tests/menu.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "../src";
import { getRowId, makeColumns, makeData } from "./helpers";

function headerOrder(): string[] {
  return Array.from(
    document.querySelectorAll(".rfg-header [data-column-id]")
  ).map((el) => (el as HTMLElement).dataset.columnId!);
}

function openMenu(columnId: string) {
  fireEvent.click(screen.getByTestId(`menu-${columnId}`));
  return screen.getByTestId(`column-menu-${columnId}`);
}

describe("column menu", () => {
  it("opens/closes with correct aria wiring and grouped actions", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    const trigger = screen.getByTestId("menu-region");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    const menu = openMenu("region");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(menu).toHaveAttribute("role", "menu");
    const groups = menu.querySelectorAll('[role="group"]');
    expect(groups.length).toBeGreaterThanOrEqual(4); // sort, pin, layout, highlight
    expect(screen.getByTestId("menu-item-sort-asc-region")).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-pin-left-region")).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-move-right-region")).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-hide-region")).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-highlight-blue-region")).toBeInTheDocument();
  });

  it("focuses the first item on open and closes on Escape restoring focus", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    const trigger = screen.getByTestId("menu-region");
    const menu = openMenu("region");
    expect(screen.getByTestId("menu-item-sort-asc-region")).toHaveFocus();

    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByTestId("column-menu-region")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("moves focus with ArrowDown / ArrowUp / Home / End", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    const menu = openMenu("region");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(screen.getByTestId("menu-item-sort-desc-region")).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(screen.getByTestId("menu-item-sort-asc-region")).toHaveFocus();
    fireEvent.keyDown(menu, { key: "End" });
    expect(screen.getByTestId("menu-item-highlight-purple-region")).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Home" });
    expect(screen.getByTestId("menu-item-sort-asc-region")).toHaveFocus();
  });

  it("sort asc / desc / clear actions work", () => {
    render(
      <DataTable data={makeData(4)} columns={makeColumns()} getRowId={getRowId} />
    );
    const header = () =>
      document.querySelector('.rfg-header [data-column-id="budget"]') as HTMLElement;

    openMenu("budget");
    fireEvent.click(screen.getByTestId("menu-item-sort-desc-budget"));
    expect(header()).toHaveAttribute("aria-sort", "descending");

    openMenu("budget");
    fireEvent.click(screen.getByTestId("menu-item-sort-asc-budget"));
    expect(header()).toHaveAttribute("aria-sort", "ascending");

    openMenu("budget");
    fireEvent.click(screen.getByTestId("menu-item-sort-clear-budget"));
    expect(header()).toHaveAttribute("aria-sort", "none");
  });

  it("clear sort is disabled when the column is not sorted", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    openMenu("budget");
    expect(screen.getByTestId("menu-item-sort-clear-budget")).toBeDisabled();
  });

  it("move left / right actions reorder and disable at the edges", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    openMenu("name");
    expect(screen.getByTestId("menu-item-move-left-name")).toBeDisabled();
    fireEvent.click(screen.getByTestId("menu-item-move-right-name"));
    expect(headerOrder()).toEqual(["region", "name", "budget", "actual"]);
  });

  it("hide column action removes the column", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    openMenu("region");
    fireEvent.click(screen.getByTestId("menu-item-hide-region"));
    expect(headerOrder()).toEqual(["name", "budget", "actual"]);
  });

  it("reset width is disabled until a resize happened, then restores the width", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    const header = () =>
      document.querySelector('.rfg-header [data-column-id="name"]') as HTMLElement;

    const menu = openMenu("name");
    expect(screen.getByTestId("menu-item-reset-width-name")).toBeDisabled();
    fireEvent.keyDown(menu, { key: "Escape" });

    fireEvent.keyDown(screen.getByTestId("resize-name"), { key: "ArrowRight" });
    expect(header().style.width).toBe("166px");

    openMenu("name");
    fireEvent.click(screen.getByTestId("menu-item-reset-width-name"));
    expect(header().style.width).toBe("150px");
  });

  it("omits actions disabled per column", () => {
    const cols = makeColumns();
    cols[0]!.sortable = false;
    cols[0]!.pinnable = false;
    cols[0]!.hideable = false;
    cols[0]!.highlightable = false;
    render(<DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />);
    openMenu("name");
    expect(screen.queryByTestId("menu-item-sort-asc-name")).not.toBeInTheDocument();
    expect(screen.queryByTestId("menu-item-pin-left-name")).not.toBeInTheDocument();
    expect(screen.queryByTestId("menu-item-hide-name")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("menu-item-highlight-blue-name")
    ).not.toBeInTheDocument();
    // layout group still offers move/reset width
    expect(screen.getByTestId("menu-item-move-right-name")).toBeInTheDocument();
  });

  it("can be disabled entirely with enableColumnMenu=false or column.menu=false", () => {
    const cols = makeColumns();
    cols[1]!.menu = false;
    const { rerender } = render(
      <DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />
    );
    expect(screen.queryByTestId("menu-region")).not.toBeInTheDocument();
    expect(screen.getByTestId("menu-name")).toBeInTheDocument();

    rerender(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        enableColumnMenu={false}
      />
    );
    expect(screen.queryByTestId("menu-name")).not.toBeInTheDocument();
  });
});