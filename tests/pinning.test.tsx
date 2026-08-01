import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type ColumnPinningState } from "../src";
import { computeColumnLayout } from "../src/utils/layout";
import { getRowId, makeColumns, makeData } from "./helpers";

function headerOrder(): string[] {
  return Array.from(
    document.querySelectorAll(".rfg-header [data-column-id]")
  ).map((el) => (el as HTMLElement).dataset.columnId!);
}

function header(id: string): HTMLElement {
  return document.querySelector(
    `.rfg-header [data-column-id="${id}"]`
  ) as HTMLElement;
}

describe("pinning — in-place semantics", () => {
  it("pinning does NOT move the column (stays at its order position)", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    const before = headerOrder();
    expect(before).toEqual(["name", "region", "budget", "actual"]);

    // pin the 3rd column: order must be untouched
    fireEvent.click(screen.getByTestId("pin-budget"));
    expect(headerOrder()).toEqual(before);
    expect(header("budget").dataset.pinned).toBe("left");

    // unpin: still untouched
    fireEvent.click(screen.getByTestId("pin-budget"));
    expect(headerOrder()).toEqual(before);
    expect(header("budget").dataset.pinned).toBeUndefined();
  });

  it("a left-pinned middle column sticks after preceding pinned columns only", () => {
    const cols = makeColumns(); // widths: name 150, region 100, budget 120, actual 120
    cols[0]!.pin = "left"; // name
    cols[2]!.pin = "left"; // budget (position 3 — stays at position 3)
    render(<DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />);

    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
    expect(header("name").style.left).toBe("0px");
    // offset only counts *pinned* predecessors (name=150), not region
    expect(header("budget").style.left).toBe("150px");
    // the last left-pinned column in order carries the edge shadow
    expect(header("budget").className).toContain("rfg-cell--pin-left-last");
    expect(header("name").className).not.toContain("rfg-cell--pin-left-last");
  });

  it("right-pinned columns keep their position and stack from the right edge", () => {
    const cols = makeColumns();
    cols[1]!.pin = "right"; // region at position 2 stays at position 2
    cols[3]!.pin = "right"; // actual (last)
    render(<DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />);

    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
    expect(header("actual").style.right).toBe("0px"); // outermost
    expect(header("region").style.right).toBe("120px"); // actual's width
    expect(header("region").className).toContain("rfg-cell--pin-right-first");
  });

  it("pinned cells stay pinned after a reorder (pin follows the column)", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    fireEvent.click(screen.getByTestId("pin-region"));
    expect(header("region").dataset.pinned).toBe("left");

    // move the pinned column left via keyboard
    fireEvent.keyDown(screen.getByTestId("grip-region"), { key: "ArrowLeft" });
    expect(headerOrder()).toEqual(["region", "name", "budget", "actual"]);
    expect(header("region").dataset.pinned).toBe("left");
    expect(header("region").style.left).toBe("0px");
  });

  it("body and total cells mirror the header pin offsets", () => {
    const cols = makeColumns();
    cols[0]!.pin = "left";
    render(
      <DataTable
        data={makeData(3)}
        columns={cols}
        getRowId={getRowId}
        showGrandTotal
      />
    );
    const bodyCell = document.querySelector(
      '.rfg-body .rfg-row [data-column-id="name"]'
    ) as HTMLElement;
    const totalCell = document.querySelector(
      '.rfg-total-row [data-column-id="name"]'
    ) as HTMLElement;
    expect(bodyCell.className).toContain("rfg-cell--pin-left");
    expect(bodyCell.style.left).toBe("0px");
    expect(totalCell.className).toContain("rfg-cell--pin-left");
    expect(totalCell.style.left).toBe("0px");
  });

  it("menu pins to either edge and unpins without moving the column", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    fireEvent.click(screen.getByTestId("menu-region"));
    fireEvent.click(screen.getByTestId("menu-item-pin-right-region"));
    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
    expect(header("region").dataset.pinned).toBe("right");

    fireEvent.click(screen.getByTestId("menu-region"));
    fireEvent.click(screen.getByTestId("menu-item-unpin-region"));
    expect(header("region").dataset.pinned).toBeUndefined();
    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
  });

  it("supports controlled pinning state without reordering", () => {
    const onColumnPinningChange = vi.fn();
    const pinning: ColumnPinningState = { left: ["budget"], right: [] };
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        columnPinning={pinning}
        onColumnPinningChange={onColumnPinningChange}
      />
    );
    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
    expect(header("budget").dataset.pinned).toBe("left");

    fireEvent.click(screen.getByTestId("pin-name"));
    expect(onColumnPinningChange).toHaveBeenCalledWith({
      left: ["budget", "name"],
      right: [],
    });
    // controlled: unchanged until the parent applies the new state
    expect(header("name").dataset.pinned).toBeUndefined();
  });

  it("hides the pin control when pinnable=false", () => {
    const cols = makeColumns();
    cols[0]!.pinnable = false;
    render(<DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />);
    expect(screen.queryByTestId("pin-name")).not.toBeInTheDocument();
    expect(screen.getByTestId("pin-region")).toBeInTheDocument();
  });

  it("computeColumnLayout keeps order and offsets pinned predecessors only", () => {
    const result = computeColumnLayout(
      [
        { id: "a", width: 100, pin: false },
        { id: "b", width: 100, pin: "left" },
        { id: "c", width: 100, pin: false },
        { id: "d", width: 100, pin: "left" },
        { id: "e", width: 100, pin: "right" },
      ],
      {},
      0,
      40
    );
    expect(result.columns.map((c) => c.id)).toEqual(["a", "b", "c", "d", "e"]);
    const byId = Object.fromEntries(result.columns.map((c) => [c.id, c]));
    expect(byId.b!.offset).toBe(40); // leading expander only
    expect(byId.d!.offset).toBe(140); // 40 + b(100) — c is not pinned
    expect(byId.d!.isLastLeftPinned).toBe(true);
    expect(byId.e!.offset).toBe(0);
    expect(result.leftPinnedWidth).toBe(240);
    expect(result.rightPinnedWidth).toBe(100);
  });
});