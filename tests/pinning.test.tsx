import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type ColumnPinningState } from "../src";
import { getRowId, makeColumns, makeData } from "./helpers";

function headerOrder(): string[] {
  return Array.from(
    document.querySelectorAll(".rfg-header [data-column-id]")
  ).map((el) => (el as HTMLElement).dataset.columnId!);
}

describe("pinned columns", () => {
  it("pins left via column def with sticky left offset", () => {
    const cols = makeColumns();
    cols[0]!.pin = "left";
    render(<DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />);
    const header = document.querySelector(
      '.rfg-header [data-column-id="name"]'
    ) as HTMLElement;
    expect(header.className).toContain("rfg-cell--pin-left");
    expect(header.style.left).toBe("0px");
    expect(header.className).toContain("rfg-cell--pin-left-last");
  });

  it("pins right via column def with sticky right offset and renders last", () => {
    const cols = makeColumns();
    cols[2]!.pin = "right"; // budget
    render(<DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />);
    expect(headerOrder()).toEqual(["name", "region", "actual", "budget"]);
    const header = document.querySelector(
      '.rfg-header [data-column-id="budget"]'
    ) as HTMLElement;
    expect(header.className).toContain("rfg-cell--pin-right");
    expect(header.style.right).toBe("0px");
    expect(header.className).toContain("rfg-cell--pin-right-first");
  });

  it("computes cumulative offsets for multiple left-pinned columns", () => {
    const cols = makeColumns();
    cols[0]!.pin = "left"; // width 150
    cols[1]!.pin = "left"; // width 100
    render(<DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />);
    const second = document.querySelector(
      '.rfg-header [data-column-id="region"]'
    ) as HTMLElement;
    expect(second.style.left).toBe("150px");
  });

  it("toggles pinning from the header button and reorders columns", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
    fireEvent.click(screen.getByTestId("pin-region"));
    expect(headerOrder()).toEqual(["region", "name", "budget", "actual"]);
    fireEvent.click(screen.getByTestId("pin-region")); // unpin
    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
  });

  it("supports controlled pinning state", () => {
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
    expect(headerOrder()[0]).toBe("budget");
    fireEvent.click(screen.getByTestId("pin-name"));
    expect(onColumnPinningChange).toHaveBeenCalledWith({
      left: ["budget", "name"],
      right: [],
    });
    // controlled: order unchanged until parent updates the prop
    expect(headerOrder()[0]).toBe("budget");
  });

  it("hides the pin control when pinnable=false", () => {
    const cols = makeColumns();
    cols[0]!.pinnable = false;
    render(<DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />);
    expect(screen.queryByTestId("pin-name")).not.toBeInTheDocument();
    expect(screen.getByTestId("pin-region")).toBeInTheDocument();
  });
});