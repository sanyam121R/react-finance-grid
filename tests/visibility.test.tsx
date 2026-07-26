// bunx vitest run tests/highlight.test.tsx tests/visibility.test.tsx 2>&1 | tail -20
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "../src";
import { getRowId, makeColumns, makeData } from "./helpers";

function headerOrder(): string[] {
  return Array.from(
    document.querySelectorAll(".rfg-header [data-column-id]")
  ).map((el) => (el as HTMLElement).dataset.columnId!);
}

describe("column visibility", () => {
  it("hides a column from the menu and keeps the rest intact", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    fireEvent.click(screen.getByTestId("menu-budget"));
    fireEvent.click(screen.getByTestId("menu-item-hide-budget"));
    expect(headerOrder()).toEqual(["name", "region", "actual"]);
    expect(
      document.querySelectorAll('.rfg-body .rfg-row [data-column-id="budget"]').length
    ).toBe(0);
  });

  it("honours column.hidden as the uncontrolled initial state", () => {
    const cols = makeColumns();
    cols[1]!.hidden = true;
    render(<DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />);
    expect(headerOrder()).toEqual(["name", "budget", "actual"]);
  });

  it("toggles visibility from the toolbar columns panel", () => {
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        showColumnsPanel
      />
    );
    fireEvent.click(screen.getByTestId("rfg-columns-panel-trigger"));
    const item = screen.getByTestId("menu-item-visibility-region");
    expect(item).toHaveAttribute("role", "menuitemcheckbox");
    expect(item).toHaveAttribute("aria-checked", "true");
    fireEvent.click(item);
    expect(headerOrder()).toEqual(["name", "budget", "actual"]);

    fireEvent.click(screen.getByTestId("rfg-columns-panel-trigger"));
    expect(screen.getByTestId("menu-item-visibility-region")).toHaveAttribute(
      "aria-checked",
      "false"
    );
    fireEvent.click(screen.getByTestId("menu-item-visibility-region"));
    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
  });

  it("respects hideable=false (menu action absent, panel item disabled)", () => {
    const cols = makeColumns();
    cols[0]!.hideable = false;
    render(
      <DataTable
        data={makeData(3)}
        columns={cols}
        getRowId={getRowId}
        showColumnsPanel
      />
    );
    fireEvent.click(screen.getByTestId("menu-name"));
    expect(screen.queryByTestId("menu-item-hide-name")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId("column-menu-name"), { key: "Escape" });

    fireEvent.click(screen.getByTestId("rfg-columns-panel-trigger"));
    expect(screen.getByTestId("menu-item-visibility-name")).toBeDisabled();
  });

  it("preserves order when a hidden column is shown again", () => {
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        showColumnsPanel
      />
    );
    // reorder first: name <-> region
    fireEvent.keyDown(screen.getByTestId("grip-region"), { key: "ArrowLeft" });
    expect(headerOrder()).toEqual(["region", "name", "budget", "actual"]);

    fireEvent.click(screen.getByTestId("menu-name"));
    fireEvent.click(screen.getByTestId("menu-item-hide-name"));
    expect(headerOrder()).toEqual(["region", "budget", "actual"]);

    fireEvent.click(screen.getByTestId("rfg-columns-panel-trigger"));
    fireEvent.click(screen.getByTestId("menu-item-visibility-name"));
    // returns to its stored slot, not to the end
    expect(headerOrder()).toEqual(["region", "name", "budget", "actual"]);
  });

  it("supports controlled visibility", () => {
    const onColumnVisibilityChange = vi.fn();
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        columnVisibility={{ region: false }}
        onColumnVisibilityChange={onColumnVisibilityChange}
      />
    );
    expect(headerOrder()).toEqual(["name", "budget", "actual"]);
    fireEvent.click(screen.getByTestId("menu-budget"));
    fireEvent.click(screen.getByTestId("menu-item-hide-budget"));
    expect(onColumnVisibilityChange).toHaveBeenCalledWith({
      region: false,
      budget: false,
    });
    expect(headerOrder()).toEqual(["name", "budget", "actual"]); // controlled
  });

  it("show all + reset layout restore every column", () => {
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        showColumnsPanel
      />
    );
    fireEvent.click(screen.getByTestId("menu-region"));
    fireEvent.click(screen.getByTestId("menu-item-hide-region"));
    fireEvent.click(screen.getByTestId("menu-budget"));
    fireEvent.click(screen.getByTestId("menu-item-hide-budget"));
    expect(headerOrder()).toEqual(["name", "actual"]);

    fireEvent.click(screen.getByTestId("rfg-columns-panel-trigger"));
    fireEvent.click(screen.getByTestId("menu-item-show-all-columns"));
    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);

    fireEvent.click(screen.getByTestId("menu-region"));
    fireEvent.click(screen.getByTestId("menu-item-hide-region"));
    fireEvent.click(screen.getByTestId("rfg-columns-panel-trigger"));
    fireEvent.click(screen.getByTestId("menu-item-reset-layout"));
    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
  });

  it("hidden columns are excluded from the grand total row", () => {
    render(
      <DataTable
        data={makeData(4)}
        columns={makeColumns()}
        getRowId={getRowId}
        showGrandTotal
      />
    );
    expect(
      document.querySelector('.rfg-total-row [data-column-id="budget"]')
    ).not.toBeNull();
    fireEvent.click(screen.getByTestId("menu-budget"));
    fireEvent.click(screen.getByTestId("menu-item-hide-budget"));
    expect(
      document.querySelector('.rfg-total-row [data-column-id="budget"]')
    ).toBeNull();
  });
});