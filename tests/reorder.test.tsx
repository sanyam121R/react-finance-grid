// bunx vitest run tests/reorder.test.tsx 2>&1 | tail -30   
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "../src";
import { getRowId, makeColumns, makeData } from "./helpers";

function headerOrder(): string[] {
  return Array.from(
    document.querySelectorAll(".rfg-header [data-column-id]")
  ).map((el) => (el as HTMLElement).dataset.columnId!);
}

describe("column drag reorder", () => {
  it("reorders via drag and drop on the grip handle", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);

    // drag "name" onto "budget" (dragging right -> dropped after target)
    fireEvent.dragStart(screen.getByTestId("grip-name"));
    const target = document.querySelector(
      '.rfg-header [data-column-id="budget"]'
    ) as HTMLElement;
    fireEvent.dragOver(target);
    expect(target.className).toContain("rfg-header-cell--drop-target");
    fireEvent.drop(target);

    expect(headerOrder()).toEqual(["region", "budget", "name", "actual"]);
  });

  it("dragging left drops before the target", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    fireEvent.dragStart(screen.getByTestId("grip-actual"));
    fireEvent.drop(
      document.querySelector('.rfg-header [data-column-id="region"]') as HTMLElement
    );
    expect(headerOrder()).toEqual(["name", "actual", "region", "budget"]);
  });

  it("clears drag state on dragEnd without reordering", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    const grip = screen.getByTestId("grip-name");
    fireEvent.dragStart(grip);
    expect(
      (document.querySelector('.rfg-header [data-column-id="name"]') as HTMLElement)
        .className
    ).toContain("rfg-header-cell--dragging");
    fireEvent.dragEnd(grip);
    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
  });

  it("moves columns with keyboard arrows on the grip", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    const grip = screen.getByTestId("grip-budget");
    fireEvent.keyDown(grip, { key: "ArrowLeft" });
    expect(headerOrder()).toEqual(["name", "budget", "region", "actual"]);
    fireEvent.keyDown(grip, { key: "ArrowRight" });
    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
  });

  it("respects movable=false (no grip, no move, not a drop target)", () => {
    const cols = makeColumns();
    cols[0]!.movable = false;
    render(<DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />);
    expect(screen.queryByTestId("grip-name")).not.toBeInTheDocument();

    // cannot drop another column onto the immovable one
    fireEvent.dragStart(screen.getByTestId("grip-actual"));
    fireEvent.drop(
      document.querySelector('.rfg-header [data-column-id="name"]') as HTMLElement
    );
    expect(headerOrder()).toEqual(["name", "region", "budget", "actual"]);
  });

  it("supports controlled columnOrder", () => {
    const onColumnOrderChange = vi.fn();
    const { rerender } = render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        columnOrder={["actual", "budget", "region", "name"]}
        onColumnOrderChange={onColumnOrderChange}
      />
    );
    expect(headerOrder()).toEqual(["actual", "budget", "region", "name"]);

    fireEvent.keyDown(screen.getByTestId("grip-budget"), { key: "ArrowLeft" });
    expect(onColumnOrderChange).toHaveBeenCalledWith([
      "budget",
      "actual",
      "region",
      "name",
    ]);
    // controlled: DOM unchanged until the parent applies it
    expect(headerOrder()).toEqual(["actual", "budget", "region", "name"]);

    rerender(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        columnOrder={["budget", "actual", "region", "name"]}
        onColumnOrderChange={onColumnOrderChange}
      />
    );
    expect(headerOrder()).toEqual(["budget", "actual", "region", "name"]);
  });

  it("uncontrolled defaultColumnOrder seeds the order", () => {
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        defaultColumnOrder={["region", "name", "actual", "budget"]}
      />
    );
    expect(headerOrder()).toEqual(["region", "name", "actual", "budget"]);
  });

  it("body cells follow the reordered header", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    fireEvent.keyDown(screen.getByTestId("grip-budget"), { key: "ArrowLeft" });
    const firstRowCells = Array.from(
      document.querySelectorAll(".rfg-body .rfg-row")[0]!.querySelectorAll("[data-column-id]")
    ).map((el) => (el as HTMLElement).dataset.columnId);
    expect(firstRowCells).toEqual(["name", "budget", "region", "actual"]);
  });

  it("reorder survives alongside sorting and resizing", () => {
    render(
      <DataTable data={makeData(4)} columns={makeColumns()} getRowId={getRowId} />
    );
    fireEvent.click(screen.getByTestId("sort-budget")); // asc
    fireEvent.keyDown(screen.getByTestId("resize-budget"), { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByTestId("grip-budget"), { key: "ArrowLeft" });

    expect(headerOrder()).toEqual(["name", "budget", "region", "actual"]);
    const budgetHeader = document.querySelector(
      '.rfg-header [data-column-id="budget"]'
    ) as HTMLElement;
    expect(budgetHeader.style.width).toBe("136px"); // 120 + 16 keyboard step
    expect(budgetHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("enableColumnReorder=false removes grips", () => {
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        enableColumnReorder={false}
      />
    );
    expect(screen.queryByTestId("grip-name")).not.toBeInTheDocument();
  });
});