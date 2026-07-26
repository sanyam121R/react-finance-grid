import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "../src";
import { getRowId, makeColumns, makeData } from "./helpers";

const renderExpandedRow = ({ row }: { row: { id: string; name: string } }) => (
  <div>detail-of-{row.id}</div>
);

describe("expandable rows", () => {
  it("renders an expander column and expands/collapses a row", () => {
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        renderExpandedRow={renderExpandedRow}
      />
    );
    const btn = screen.getByTestId("expand-r1");
    expect(btn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(btn);
    expect(screen.getByText("detail-of-r1")).toBeInTheDocument();
    expect(screen.getByTestId("expand-r1")).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByTestId("expand-r1"));
    expect(screen.queryByText("detail-of-r1")).not.toBeInTheDocument();
  });

  it("supports multiple rows expanded simultaneously", () => {
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        renderExpandedRow={renderExpandedRow}
      />
    );
    fireEvent.click(screen.getByTestId("expand-r0"));
    fireEvent.click(screen.getByTestId("expand-r2"));
    expect(screen.getByText("detail-of-r0")).toBeInTheDocument();
    expect(screen.getByText("detail-of-r2")).toBeInTheDocument();
  });

  it("respects getRowCanExpand", () => {
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        renderExpandedRow={renderExpandedRow}
        getRowCanExpand={(r) => r.id !== "r1"}
      />
    );
    expect(screen.getByTestId("expand-r0")).toBeInTheDocument();
    expect(screen.queryByTestId("expand-r1")).not.toBeInTheDocument();
  });

  it("fires the async-ready onRowExpand hook only on expand", () => {
    const onRowExpand = vi.fn().mockResolvedValue(undefined);
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        renderExpandedRow={renderExpandedRow}
        onRowExpand={onRowExpand}
      />
    );
    fireEvent.click(screen.getByTestId("expand-r0")); // expand
    fireEvent.click(screen.getByTestId("expand-r0")); // collapse
    expect(onRowExpand).toHaveBeenCalledTimes(1);
    expect(onRowExpand.mock.calls[0]![0].id).toBe("r0");
  });

  it("supports controlled expansion state", () => {
    const onExpandedRowIdsChange = vi.fn();
    const { rerender } = render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        renderExpandedRow={renderExpandedRow}
        expandedRowIds={new Set()}
        onExpandedRowIdsChange={onExpandedRowIdsChange}
      />
    );
    fireEvent.click(screen.getByTestId("expand-r1"));
    expect(onExpandedRowIdsChange).toHaveBeenCalledTimes(1);
    expect([...onExpandedRowIdsChange.mock.calls[0]![0]]).toEqual(["r1"]);
    expect(screen.queryByText("detail-of-r1")).not.toBeInTheDocument();

    rerender(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        renderExpandedRow={renderExpandedRow}
        expandedRowIds={new Set(["r1"])}
        onExpandedRowIdsChange={onExpandedRowIdsChange}
      />
    );
    expect(screen.getByText("detail-of-r1")).toBeInTheDocument();
  });

  it("provides a collapse() escape hatch in the expansion context", () => {
    render(
      <DataTable
        data={makeData(2)}
        columns={makeColumns()}
        getRowId={getRowId}
        renderExpandedRow={({ row, collapse }) => (
          <button onClick={collapse}>close-{row.id}</button>
        )}
      />
    );
    fireEvent.click(screen.getByTestId("expand-r0"));
    fireEvent.click(screen.getByText("close-r0"));
    expect(screen.queryByText("close-r0")).not.toBeInTheDocument();
  });
});