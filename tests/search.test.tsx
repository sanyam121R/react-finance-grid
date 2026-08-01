import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "../src";
import { getRowId, makeColumns, makeData } from "./helpers";

describe("search", () => {
  it("filters rows across searchable columns (built-in toolbar)", () => {
    render(
      <DataTable
        data={makeData(5)}
        columns={makeColumns()}
        getRowId={getRowId}
        showSearch
      />
    );
    fireEvent.change(screen.getByTestId("rfg-search"), {
      target: { value: "marketing" },
    });
    expect(screen.getByText("Marketing 1")).toBeInTheDocument();
    expect(screen.queryByText("Engineering 0")).not.toBeInTheDocument();
  });

  it("excludes columns with searchable=false", () => {
    const cols = makeColumns();
    cols[1]!.searchable = false; // region not searchable
    render(
      <DataTable data={makeData(5)} columns={cols} getRowId={getRowId} showSearch />
    );
    fireEvent.change(screen.getByTestId("rfg-search"), {
      target: { value: "EMEA" },
    });
    expect(screen.getByText("No matching rows")).toBeInTheDocument();
  });

  it("uses custom getSearchText", () => {
    const cols = makeColumns();
    cols[0]!.getSearchText = (r) => `code:${r.id}`;
    render(
      <DataTable data={makeData(5)} columns={cols} getRowId={getRowId} showSearch />
    );
    fireEvent.change(screen.getByTestId("rfg-search"), {
      target: { value: "code:r3" },
    });
    expect(screen.getByText("Finance 3")).toBeInTheDocument();
    expect(screen.queryByText("Sales 2")).not.toBeInTheDocument();
  });

  it("supports controlled search value", () => {
    const onSearchValueChange = vi.fn();
    const { rerender } = render(
      <DataTable
        data={makeData(5)}
        columns={makeColumns()}
        getRowId={getRowId}
        showSearch
        searchValue=""
        onSearchValueChange={onSearchValueChange}
      />
    );
    fireEvent.change(screen.getByTestId("rfg-search"), {
      target: { value: "sales" },
    });
    expect(onSearchValueChange).toHaveBeenCalledWith("sales");
    // still unfiltered because parent hasn't updated the prop
    expect(screen.getByText("Engineering 0")).toBeInTheDocument();

    rerender(
      <DataTable
        data={makeData(5)}
        columns={makeColumns()}
        getRowId={getRowId}
        showSearch
        searchValue="sales"
        onSearchValueChange={onSearchValueChange}
      />
    );
    expect(screen.getByText("Sales 2")).toBeInTheDocument();
    expect(screen.queryByText("Engineering 0")).not.toBeInTheDocument();
  });
});