// bunx vitest run tests/multisort.test.tsx tests/extras.test.tsx 2>&1 | tail -22
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DataTable,
  TableSkeleton,
  formatCurrency,
  createCurrencyFormatter,
  formatPercent,
  formatNumber,
  formatVariance,
  type ColumnDef,
} from "../src";
import { getRowId, makeColumns, makeData, type Dept } from "./helpers";

describe("density modes", () => {
  it("applies density row heights and root class", () => {
    const { rerender } = render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        density="compact"
      />
    );
    expect(document.querySelector(".rfg-root")!.className).toContain(
      "rfg-root--compact"
    );
    expect(
      (document.querySelector(".rfg-body .rfg-row") as HTMLElement).style.height
    ).toBe("32px");

    rerender(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        density="spacious"
      />
    );
    expect(
      (document.querySelector(".rfg-body .rfg-row") as HTMLElement).style.height
    ).toBe("56px");
  });

  it("explicit rowHeight overrides density", () => {
    render(
      <DataTable
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        density="compact"
        rowHeight={70}
      />
    );
    expect(
      (document.querySelector(".rfg-body .rfg-row") as HTMLElement).style.height
    ).toBe("70px");
  });

  it("TableSkeleton honours density", () => {
    render(<TableSkeleton rows={2} columns={3} density="compact" />);
    expect(
      (document.querySelector(".rfg-row") as HTMLElement).style.height
    ).toBe("32px");
  });
});

describe("empty vs no-results states", () => {
  it("shows emptyMessage for an empty dataset", () => {
    render(
      <DataTable
        data={[]}
        columns={makeColumns()}
        getRowId={getRowId}
        showSearch
        emptyMessage="Nothing loaded"
        noResultsMessage="Nothing matched"
      />
    );
    expect(screen.getByTestId("rfg-empty")).toHaveTextContent("Nothing loaded");
  });

  it("shows noResultsMessage when a search filters everything out", () => {
    render(
      <DataTable
        data={makeData(4)}
        columns={makeColumns()}
        getRowId={getRowId}
        showSearch
        emptyMessage="Nothing loaded"
        noResultsMessage="Nothing matched"
      />
    );
    fireEvent.change(screen.getByTestId("rfg-search"), {
      target: { value: "zzzz" },
    });
    expect(screen.getByTestId("rfg-no-results")).toHaveTextContent("Nothing matched");
  });
});

describe("numeric alignment defaults", () => {
  it("right-aligns numeric columns without an explicit align", () => {
    const cols: ColumnDef<Dept>[] = [
      { id: "name", header: "Name", accessorKey: "name" },
      { id: "budget", header: "Budget", accessorKey: "budget" },
      { id: "region", header: "Region", accessorKey: "region", align: "center" },
    ];
    render(<DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />);
    const header = (id: string) =>
      document.querySelector(`.rfg-header [data-column-id="${id}"]`)!.className;
    expect(header("budget")).toContain("rfg-cell--right");
    expect(header("name")).not.toContain("rfg-cell--right");
    expect(header("region")).toContain("rfg-cell--center"); // explicit wins
    const bodyCell = document.querySelector(
      '.rfg-body .rfg-row [data-column-id="budget"]'
    )!;
    expect(bodyCell.className).toContain("rfg-cell--right");
  });
});

describe("toolbar slots", () => {
  it("renders toolbarStart and toolbarEnd content", () => {
    render(
      <DataTable
        data={makeData(2)}
        columns={makeColumns()}
        getRowId={getRowId}
        toolbarStart={<span>slot-start</span>}
        toolbarEnd={<span>slot-end</span>}
      />
    );
    expect(screen.getByText("slot-start")).toBeInTheDocument();
    expect(screen.getByText("slot-end")).toBeInTheDocument();
  });
});

describe("finance formatters", () => {
  it("formats currency, accounting negatives and compact notation", () => {
    expect(formatCurrency(1234.56, { locale: "en-US" })).toBe("$1,235");
    expect(
      formatCurrency(-1200, { locale: "en-US", accounting: true })
    ).toBe("($1,200)");
    expect(formatCurrency(1_250_000, { locale: "en-US", compact: true })).toBe(
      "$1.3M"
    );
    expect(formatCurrency(null)).toBe("—");
    const eur = createCurrencyFormatter({ currency: "EUR", locale: "de-DE" });
    expect(eur(1000)).toContain("€");
  });

  it("formats percent, numbers and variance", () => {
    expect(formatPercent(0.1234, { locale: "en-US" })).toBe("12.3%");
    expect(formatPercent(12.34, { locale: "en-US", alreadyScaled: true })).toBe(
      "12.3%"
    );
    expect(formatNumber(1234567.891, { locale: "en-US" })).toBe("1,234,567.89");
    expect(formatNumber(null)).toBe("—");
    expect(formatVariance(1200, { locale: "en-US" })).toBe("+1,200");
    expect(formatVariance(-1200, { locale: "en-US" })).toBe("-1,200");
    expect(formatVariance(0, { locale: "en-US" })).toBe("0");
    expect(
      formatVariance(-1200, { locale: "en-US", currencyStyle: true })
    ).toBe("-$1,200");
  });
});