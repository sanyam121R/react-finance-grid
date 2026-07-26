import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "../src";
import { getRowId, makeColumns, makeData } from "./helpers";

describe("virtualization / windowing", () => {
  it("mounts only visible rows plus overscan for large datasets", () => {
    render(
      <DataTable
        data={makeData(1000)}
        columns={makeColumns()}
        getRowId={getRowId}
        height={300}
        rowHeight={40}
        overscan={3}
      />
    );
    const rows = document.querySelectorAll(".rfg-body .rfg-row");
    // viewport ~300px / 40px = ~8 visible + overscan; far fewer than 1000
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.length).toBeLessThan(25);
    // spacer preserves full scroll height
    const body = document.querySelector(".rfg-body") as HTMLElement;
    expect(body.style.height).toBe(`${1000 * 40}px`);
  });

  it("renders a different window after scrolling", () => {
    render(
      <DataTable
        data={makeData(1000)}
        columns={makeColumns()}
        getRowId={getRowId}
        height={300}
        rowHeight={40}
        overscan={2}
      />
    );
    expect(screen.getByText("Engineering 0")).toBeInTheDocument();
    const scroller = screen.getByTestId("rfg-scroll");
    scroller.scrollTop = 20000; // row ~500
    fireEvent.scroll(scroller);
    expect(screen.queryByText("Engineering 0")).not.toBeInTheDocument();
    expect(screen.getByText("Engineering 500")).toBeInTheDocument();
  });

  it("accounts for expanded panel heights in the layout", () => {
    render(
      <DataTable
        data={makeData(50)}
        columns={makeColumns()}
        getRowId={getRowId}
        height={300}
        rowHeight={40}
        expandedRowHeight={120}
        renderExpandedRow={({ rowId }) => <div>panel-{rowId}</div>}
      />
    );
    fireEvent.click(screen.getByTestId("expand-r0"));
    const body = document.querySelector(".rfg-body") as HTMLElement;
    expect(body.style.height).toBe(`${50 * 40 + 120}px`);
    expect(screen.getByText("panel-r0")).toBeInTheDocument();
  });

  it("disableVirtualization renders every row", () => {
    render(
      <DataTable
        data={makeData(100)}
        columns={makeColumns()}
        getRowId={getRowId}
        height={300}
        rowHeight={40}
        disableVirtualization
      />
    );
    expect(document.querySelectorAll(".rfg-body .rfg-row").length).toBe(100);
  });
});