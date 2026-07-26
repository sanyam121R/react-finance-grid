// bunx vitest run tests/persistence.test.tsx 2>&1 | tail -18
// bunx vitest run tests/persistence.test.tsx 2>&1 | tail -25
// bunx vitest run tests/persistence.test.tsx 2>&1 | grep -B30 "1/2" | head -45
import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DataTable,
  LAYOUT_VERSION,
  parseLayout,
  reconcileLayout,
  serializeLayout,
  createEmptyLayout,
  type DataTableHandle,
  type GridLayoutState,
} from "../src";
import { getRowId, makeColumns, makeData } from "./helpers";

function headerOrder(): string[] {
  return Array.from(
    document.querySelectorAll(".rfg-header [data-column-id]")
  ).map((el) => (el as HTMLElement).dataset.columnId!);
}
const headerCell = (id: string) =>
  document.querySelector(`.rfg-header [data-column-id="${id}"]`) as HTMLElement;

describe("layout persistence helpers", () => {
  it("serializes and parses round-trip", () => {
    const layout: GridLayoutState = {
      ...createEmptyLayout(),
      columnOrder: ["b", "a"],
      columnPinning: { left: ["b"], right: [] },
      columnWidths: { a: 200 },
      columnVisibility: { a: false },
      columnHighlights: { b: "blue" },
      sorting: [{ columnId: "a", direction: "desc" }],
    };
    const json = serializeLayout(layout);
    expect(typeof json).toBe("string");
    expect(parseLayout(json)).toEqual(layout);
  });

  it("rejects malformed or version-mismatched payloads", () => {
    expect(parseLayout("not json")).toBeNull();
    expect(parseLayout(null)).toBeNull();
    expect(parseLayout(JSON.stringify({ version: 999 }))).toBeNull();
    const sanitized = parseLayout(
      JSON.stringify({
        version: LAYOUT_VERSION,
        columnOrder: ["a", 5],
        columnWidths: { a: "wide" },
        columnHighlights: { a: "chartreuse" },
        sorting: [{ columnId: "a", direction: "sideways" }],
      })
    );
    expect(sanitized).toEqual(createEmptyLayout());
  });

  it("reconciles unknown and new columns", () => {
    const layout: GridLayoutState = {
      ...createEmptyLayout(),
      columnOrder: ["gone", "b"],
      columnPinning: { left: ["gone"], right: ["b"] },
      columnWidths: { gone: 100, b: 150 },
      sorting: [{ columnId: "gone", direction: "asc" }],
    };
    const out = reconcileLayout(layout, ["a", "b"]);
    expect(out.columnOrder).toEqual(["b", "a"]); // unknown dropped, new appended
    expect(out.columnPinning).toEqual({ left: [], right: ["b"] });
    expect(out.columnWidths).toEqual({ b: 150 });
    expect(out.sorting).toEqual([]);
  });
});

describe("layout persistence on the grid", () => {
  it("serializeLayout() captures order, pin, width, visibility, highlight and sorting", () => {
    const ref = createRef<DataTableHandle>();
    render(
      <DataTable
        ref={ref}
        data={makeData(4)}
        columns={makeColumns()}
        getRowId={getRowId}
      />
    );
    fireEvent.keyDown(screen.getByTestId("grip-budget"), { key: "ArrowLeft" });
    fireEvent.click(screen.getByTestId("pin-budget"));
    fireEvent.keyDown(screen.getByTestId("resize-budget"), { key: "ArrowRight" });
    fireEvent.click(screen.getByTestId("menu-region"));
    fireEvent.click(screen.getByTestId("menu-item-highlight-red-region"));
    fireEvent.click(screen.getByTestId("menu-actual"));
    fireEvent.click(screen.getByTestId("menu-item-hide-actual"));
    fireEvent.click(screen.getByTestId("sort-name")); // asc

    const layout = ref.current!.serializeLayout();
    expect(layout.version).toBe(LAYOUT_VERSION);
    expect(layout.columnOrder).toEqual(["name", "budget", "region", "actual"]);
    expect(layout.columnPinning).toEqual({ left: ["budget"], right: [] });
    expect(layout.columnWidths).toEqual({ budget: 136 });
    expect(layout.columnVisibility).toEqual({ actual: false });
    expect(layout.columnHighlights).toEqual({ region: "red" });
    expect(layout.sorting).toEqual([{ columnId: "name", direction: "asc" }]);
  });

  it("restoreLayout() applies a snapshot (object or JSON string)", () => {
    const ref = createRef<DataTableHandle>();
    render(
      <DataTable
        ref={ref}
        data={makeData(4)}
        columns={makeColumns()}
        getRowId={getRowId}
      />
    );
    const snapshot: GridLayoutState = {
      version: LAYOUT_VERSION,
      columnOrder: ["actual", "budget", "region", "name"],
      columnPinning: { left: [], right: ["name"] },
      columnWidths: { actual: 222 },
      columnVisibility: { region: false },
      columnHighlights: { budget: "purple" },
      sorting: [{ columnId: "budget", direction: "desc" }],
    };

    act(() => ref.current!.restoreLayout(serializeLayout(snapshot)));
    expect(headerOrder()).toEqual(["actual", "budget", "name"]); // region hidden
    expect(headerCell("actual").style.width).toBe("222px");
    expect(headerCell("name").dataset.pinned).toBe("right");
    expect(headerCell("budget").dataset.highlight).toBe("purple");
    expect(headerCell("budget")).toHaveAttribute("aria-sort", "descending");

    // round-trip equality
    expect(ref.current!.serializeLayout()).toEqual(snapshot);
  });

  it("hydrates uncontrolled state from defaultLayout", () => {
    render(
      <DataTable
        data={makeData(4)}
        columns={makeColumns()}
        getRowId={getRowId}
        defaultLayout={{
          version: LAYOUT_VERSION,
          columnOrder: ["budget", "name", "region", "actual"],
          columnPinning: { left: ["budget"], right: [] },
          columnWidths: { name: 180 },
          columnVisibility: { actual: false },
          columnHighlights: { region: "yellow" },
          sorting: [{ columnId: "budget", direction: "desc" }],
        }}
      />
    );
    expect(headerOrder()).toEqual(["budget", "name", "region"]);
    expect(headerCell("budget").dataset.pinned).toBe("left");
    expect(headerCell("name").style.width).toBe("180px");
    expect(headerCell("region").dataset.highlight).toBe("yellow");
    expect(headerCell("budget")).toHaveAttribute("aria-sort", "descending");
  });

  it("ignores an invalid defaultLayout and falls back to defaults", () => {
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        defaultLayout={{ version: 42 } as unknown as GridLayoutState}
      />
    );
    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
  });

  it("fires onLayoutChange for layout mutations (not on mount)", () => {
    const onLayoutChange = vi.fn();
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        onLayoutChange={onLayoutChange}
      />
    );
    expect(onLayoutChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("pin-region"));
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    expect(onLayoutChange.mock.calls[0]![0].columnPinning).toEqual({
      left: ["region"],
      right: [],
    });

    fireEvent.keyDown(screen.getByTestId("grip-region"), { key: "ArrowLeft" });
    expect(onLayoutChange).toHaveBeenCalledTimes(2);
    expect(onLayoutChange.mock.calls[1]![0].columnOrder).toEqual([
      "region",
      "name",
      "budget",
      "actual",
    ]);
  });

  it("resetLayout() clears user layout state", () => {
    const ref = createRef<DataTableHandle>();
    render(
      <DataTable
        ref={ref}
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
      />
    );
    fireEvent.keyDown(screen.getByTestId("grip-budget"), { key: "ArrowLeft" });
    fireEvent.click(screen.getByTestId("pin-budget"));
    fireEvent.click(screen.getByTestId("sort-budget"));
    act(() => ref.current!.resetLayout());

    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
    expect(headerCell("budget").dataset.pinned).toBeUndefined();
    expect(headerCell("budget")).toHaveAttribute("aria-sort", "none");
    expect(ref.current!.serializeLayout().sorting).toEqual([]);
  });
});