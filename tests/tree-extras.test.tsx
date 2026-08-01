import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { TreeDataTable, type DataTableHandle, type TreeColumnDef } from "../src";

interface Row { id: string; name: string; v: number; children?: Row[] }
const columns: TreeColumnDef<Row>[] = [
  { id: "name", header: "Name", accessorKey: "name" },
  { id: "v", header: "Value", accessorKey: "v" },
];

describe("TreeDataTable — parity smoke", () => {
  it("virtualizes flattened rows (only a window is mounted)", () => {
    const big: Row[] = Array.from({ length: 500 }, (_, i) => ({
      id: `r${i}`, name: `Row ${i}`, v: i,
    }));
    render(
      <TreeDataTable<Row>
        data={big}
        columns={columns}
        getRowId={(r) => r.id}
        getRowChildren={() => null}
        height={400}
        rowHeight={40}
        overscan={2}
      />
    );
    const mounted = document.querySelectorAll('[data-testid^="tree-row-"]').length;
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(50); // not all 500

    // scrolling moves the window
    const scroll = screen.getByTestId("rfg-tree-scroll");
    Object.defineProperty(scroll, "scrollTop", { value: 8000, writable: true });
    fireEvent.scroll(scroll);
    expect(screen.queryByTestId("tree-row-r0")).toBeNull();
    expect(screen.getByTestId("tree-row-r200")).toBeInTheDocument();
  });

  it("exposes the same layout persistence handle as DataTable", () => {
    const ref = createRef<DataTableHandle>();
    render(
      <TreeDataTable<Row>
        data={[{ id: "a", name: "A", v: 1 }]}
        columns={columns}
        getRowId={(r) => r.id}
        getRowChildren={() => null}
        ref={ref}
      />
    );
    fireEvent.click(screen.getByTestId("sort-v"));
    const snapshot = ref.current!.serializeLayout();
    expect(snapshot.sorting).toEqual([{ columnId: "v", direction: "asc" }]);
    expect(snapshot.columnOrder).toEqual(["name", "v"]);

    act(() => ref.current!.resetLayout());
    expect(ref.current!.serializeLayout().sorting).toEqual([]);
    act(() => ref.current!.restoreLayout(snapshot));
    expect(ref.current!.serializeLayout().sorting).toEqual([
      { columnId: "v", direction: "asc" },
    ]);
  });

  it("column pinning and visibility work through the shared header", () => {
    render(
      <TreeDataTable<Row>
        data={[{ id: "a", name: "A", v: 1 }]}
        columns={columns}
        getRowId={(r) => r.id}
        getRowChildren={() => null}
      />
    );
    fireEvent.click(screen.getByTestId("pin-name"));
    const cell = screen
      .getByTestId("tree-row-a")
      .querySelector('[data-column-id="name"]')!;
    expect(cell.className).toContain("rfg-cell--pin-left");

    fireEvent.click(screen.getByTestId("menu-v"));
    fireEvent.click(screen.getByTestId("menu-item-hide-v"));
    expect(
      screen.getByTestId("tree-row-a").querySelector('[data-column-id="v"]')
    ).toBeNull();
  });
});
