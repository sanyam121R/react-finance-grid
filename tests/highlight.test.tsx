import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type ColumnHighlightState } from "../src";
import { getRowId, makeColumns, makeData } from "./helpers";

const headerCell = (id: string) =>
  document.querySelector(`.rfg-header [data-column-id="${id}"]`) as HTMLElement;
const bodyCells = (id: string) =>
  Array.from(
    document.querySelectorAll(`.rfg-body .rfg-row [data-column-id="${id}"]`)
  ) as HTMLElement[];
const totalCell = (id: string) =>
  document.querySelector(`.rfg-total-row [data-column-id="${id}"]`) as HTMLElement;

describe("column highlight / coloring", () => {
  it("applies a highlight from the column menu to header, body and total cells", () => {
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        showGrandTotal
      />
    );
    expect(headerCell("budget").dataset.highlight).toBeUndefined();

    fireEvent.click(screen.getByTestId("menu-budget"));
    fireEvent.click(screen.getByTestId("menu-item-highlight-green-budget"));

    expect(headerCell("budget").dataset.highlight).toBe("green");
    expect(headerCell("budget").className).toContain("rfg-cell--hl-green");
    expect(bodyCells("budget").length).toBeGreaterThan(0);
    for (const cell of bodyCells("budget")) {
      expect(cell.className).toContain("rfg-cell--hl-green");
      expect(cell.className).toContain("rfg-cell--highlight");
    }
    expect(totalCell("budget").className).toContain("rfg-cell--hl-green");
    // other columns untouched
    expect(headerCell("name").className).not.toContain("rfg-cell--highlight");
  });

  it("supports all built-in variants and clearing", () => {
    render(
      <DataTable data={makeData(2)} columns={makeColumns()} getRowId={getRowId} />
    );
    for (const color of ["blue", "green", "yellow", "red", "purple"] as const) {
      fireEvent.click(screen.getByTestId("menu-region"));
      fireEvent.click(screen.getByTestId(`menu-item-highlight-${color}-region`));
      expect(headerCell("region").dataset.highlight).toBe(color);
    }
    fireEvent.click(screen.getByTestId("menu-region"));
    fireEvent.click(screen.getByTestId("menu-item-highlight-none-region"));
    expect(headerCell("region").dataset.highlight).toBeUndefined();
    expect(headerCell("region").className).not.toContain("rfg-cell--highlight");
  });

  it("honours column.highlight as the uncontrolled initial value", () => {
    const cols = makeColumns();
    cols[2]!.highlight = "yellow";
    render(<DataTable data={makeData(2)} columns={cols} getRowId={getRowId} />);
    expect(headerCell("budget").dataset.highlight).toBe("yellow");
  });

  it("supports controlled highlight state", () => {
    const onColumnHighlightsChange = vi.fn();
    const highlights: ColumnHighlightState = { name: "purple" };
    const { rerender } = render(
      <DataTable
        data={makeData(2)}
        columns={makeColumns()}
        getRowId={getRowId}
        columnHighlights={highlights}
        onColumnHighlightsChange={onColumnHighlightsChange}
      />
    );
    expect(headerCell("name").dataset.highlight).toBe("purple");

    fireEvent.click(screen.getByTestId("menu-region"));
    fireEvent.click(screen.getByTestId("menu-item-highlight-red-region"));
    expect(onColumnHighlightsChange).toHaveBeenCalledWith({
      name: "purple",
      region: "red",
    });
    // controlled: not applied until the parent updates the prop
    expect(headerCell("region").dataset.highlight).toBeUndefined();

    rerender(
      <DataTable
        data={makeData(2)}
        columns={makeColumns()}
        getRowId={getRowId}
        columnHighlights={{ name: "purple", region: "red" }}
        onColumnHighlightsChange={onColumnHighlightsChange}
      />
    );
    expect(headerCell("region").dataset.highlight).toBe("red");
  });

  it("highlightTotals=false keeps the total row unstyled", () => {
    render(
      <DataTable
        data={makeData(2)}
        columns={makeColumns()}
        getRowId={getRowId}
        showGrandTotal
        highlightTotals={false}
        columnHighlights={{ budget: "blue" }}
      />
    );
    expect(headerCell("budget").className).toContain("rfg-cell--hl-blue");
    expect(totalCell("budget").className).not.toContain("rfg-cell--hl-blue");
  });

  it("hides highlight actions when highlightable=false", () => {
    const cols = makeColumns();
    cols[1]!.highlightable = false;
    render(<DataTable data={makeData(2)} columns={cols} getRowId={getRowId} />);
    fireEvent.click(screen.getByTestId("menu-region"));
    expect(
      screen.queryByTestId("menu-item-highlight-blue-region")
    ).not.toBeInTheDocument();
  });
});