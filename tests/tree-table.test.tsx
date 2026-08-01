import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TreeDataTable, type TreeColumnDef } from "../src";

interface Acct {
  id: string;
  code?: string;
  name: string;
  budget: number;
  actual: number;
  children?: Acct[];
}

const data = (): Acct[] => [
  { id: "ads", name: "Advertising Expense", budget: 2, actual: 2 },
  {
    id: "benefits", name: "Benefits Expense", budget: 300, actual: 290,
    children: [
      { id: "8247", code: "8247", name: "Employee Welfare", budget: 100, actual: 95 },
      { id: "8725", code: "8725", name: "Certification Expenses", budget: 150, actual: 145 },
      { id: "8739", code: "8739", name: "Gratuity", budget: 50, actual: 50 },
    ],
  },
  { id: "software", name: "Software", budget: 500, actual: 480 },
];

const columns = (): TreeColumnDef<Acct>[] => [
  { id: "name", header: "Account", accessorKey: "name", width: 220 },
  { id: "budget", header: "Budget", accessorKey: "budget", align: "right", aggregate: "sum" },
  { id: "actual", header: "Actual", accessorKey: "actual", align: "right", aggregate: "sum" },
];

const getRowId = (r: Acct) => r.id;
const getRowChildren = (r: Acct) => r.children;

const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="tree-row-"]')).map((el) =>
    el.getAttribute("data-testid")!.replace("tree-row-", "")
  );

describe("TreeDataTable — expansion as table continuation", () => {
  it("renders children as rows under the SAME column headings", () => {
    render(
      <TreeDataTable<Acct>
        data={data()}
        columns={columns()}
        getRowId={getRowId}
        getRowChildren={getRowChildren}
      />
    );
    // single shared header row
    expect(document.querySelectorAll(".rfg-header").length).toBe(1);
    expect(rowIds()).toEqual(["ads", "benefits", "software"]);

    fireEvent.click(screen.getByTestId("tree-expand-benefits"));
    expect(rowIds()).toEqual(["ads", "benefits", "8247", "8725", "8739", "software"]);

    // child cells live in the same columns as parent cells
    const child = screen.getByTestId("tree-row-8725");
    expect(within(child).getByText("Certification Expenses")).toBeInTheDocument();
    expect(child.querySelector('[data-column-id="budget"]')).toHaveTextContent("150");
    expect(child).toHaveAttribute("aria-level", "2");
    expect(child).toHaveAttribute("data-depth", "1");

    // collapse removes them again
    fireEvent.click(screen.getByTestId("tree-expand-benefits"));
    expect(rowIds()).toEqual(["ads", "benefits", "software"]);
  });

  it("indents the tree column by depth and aligns leaves with a spacer", () => {
    render(
      <TreeDataTable<Acct>
        data={data()}
        columns={columns()}
        getRowId={getRowId}
        getRowChildren={getRowChildren}
        indentSize={32}
      />
    );
    fireEvent.click(screen.getByTestId("tree-expand-benefits"));
    const childTreeCell = screen
      .getByTestId("tree-row-8247")
      .querySelector('[data-column-id="name"]')!;
    const indent = childTreeCell.querySelector(".rfg-tree-indent") as HTMLElement;
    expect(indent.style.width).toBe("32px");
    // leaf rows get a spacer instead of a chevron
    expect(childTreeCell.querySelector(".rfg-tree-toggle")).toBeNull();
    expect(childTreeCell.querySelector(".rfg-tree-toggle-spacer")).not.toBeNull();
    // roots have no indent
    const rootCell = screen
      .getByTestId("tree-row-ads")
      .querySelector('[data-column-id="name"]')!;
    expect(rootCell.querySelector(".rfg-tree-indent")).toBeNull();
  });

  it("exposes treegrid semantics (aria-expanded / level / posinset)", () => {
    render(
      <TreeDataTable<Acct>
        data={data()}
        columns={columns()}
        getRowId={getRowId}
        getRowChildren={getRowChildren}
      />
    );
    expect(screen.getByRole("treegrid")).toBeInTheDocument();
    const benefits = screen.getByTestId("tree-row-benefits");
    expect(benefits).toHaveAttribute("aria-expanded", "false");
    expect(benefits).toHaveAttribute("aria-level", "1");
    // leaves are not annotated as expandable
    expect(screen.getByTestId("tree-row-ads")).not.toHaveAttribute("aria-expanded");

    fireEvent.click(screen.getByTestId("tree-expand-benefits"));
    expect(screen.getByTestId("tree-row-benefits")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("tree-row-8725")).toHaveAttribute("aria-posinset", "2");
    expect(screen.getByTestId("tree-row-8725")).toHaveAttribute("aria-setsize", "3");
  });

  it("sorting keeps children glued under their parent in BOTH directions", () => {
    render(
      <TreeDataTable<Acct>
        data={data()}
        columns={columns()}
        getRowId={getRowId}
        getRowChildren={getRowChildren}
        defaultExpandedRowIds={new Set(["benefits"])}
      />
    );
    fireEvent.click(screen.getByTestId("sort-budget")); // asc
    expect(rowIds()).toEqual(["ads", "benefits", "8739", "8247", "8725", "software"]);
    fireEvent.click(screen.getByTestId("sort-budget")); // desc — children must not tear away
    expect(rowIds()).toEqual(["software", "benefits", "8725", "8247", "8739", "ads"]);
  });

  it("search keeps the ancestor chain and reveals matches under collapsed parents", () => {
    render(
      <TreeDataTable<Acct>
        data={data()}
        columns={columns()}
        getRowId={getRowId}
        getRowChildren={getRowChildren}
        showSearch
      />
    );
    fireEvent.change(screen.getByTestId("rfg-search"), {
      target: { value: "certification" },
    });
    expect(rowIds()).toEqual(["benefits", "8725"]);
    // clearing restores the collapsed tree
    fireEvent.change(screen.getByTestId("rfg-search"), { target: { value: "" } });
    expect(rowIds()).toEqual(["ads", "benefits", "software"]);
  });

  it("shows the no-results message when nothing matches", () => {
    render(
      <TreeDataTable<Acct>
        data={data()}
        columns={columns()}
        getRowId={getRowId}
        getRowChildren={getRowChildren}
        showSearch
        noResultsMessage="Nothing found"
      />
    );
    fireEvent.change(screen.getByTestId("rfg-search"), { target: { value: "zzz" } });
    expect(screen.getByTestId("rfg-no-results")).toHaveTextContent("Nothing found");
  });

  it("grand total aggregates ROOT rows only — expanding must not double count", () => {
    render(
      <TreeDataTable<Acct>
        data={data()}
        columns={columns()}
        getRowId={getRowId}
        getRowChildren={getRowChildren}
        showGrandTotal
        grandTotalLabel="Total Expenses"
      />
    );
    const total = () => screen.getByTestId("rfg-grand-total");
    expect(within(total()).getByText("Total Expenses")).toBeInTheDocument();
    expect(within(total()).getByText("802")).toBeInTheDocument(); // 2+300+500

    fireEvent.click(screen.getByTestId("tree-expand-benefits"));
    // children visible, but totals unchanged
    expect(within(total()).getByText("802")).toBeInTheDocument();
  });

  it("supports controlled expansion", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TreeDataTable<Acct>
        data={data()}
        columns={columns()}
        getRowId={getRowId}
        getRowChildren={getRowChildren}
        expandedRowIds={new Set<string>()}
        onExpandedRowIdsChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId("tree-expand-benefits"));
    // controlled: nothing expands until the parent re-renders with new state
    expect(rowIds()).toEqual(["ads", "benefits", "software"]);
    expect(onChange).toHaveBeenCalledWith(new Set(["benefits"]));

    rerender(
      <TreeDataTable<Acct>
        data={data()}
        columns={columns()}
        getRowId={getRowId}
        getRowChildren={getRowChildren}
        expandedRowIds={new Set(["benefits"])}
        onExpandedRowIdsChange={onChange}
      />
    );
    expect(rowIds()).toContain("8247");
  });

  it("onRowExpand fires on expand only; toggle click does not trigger onRowClick", () => {
    const onRowExpand = vi.fn();
    const onRowClick = vi.fn();
    render(
      <TreeDataTable<Acct>
        data={data()}
        columns={columns()}
        getRowId={getRowId}
        getRowChildren={getRowChildren}
        onRowExpand={onRowExpand}
        onRowClick={onRowClick}
      />
    );
    fireEvent.click(screen.getByTestId("tree-expand-benefits"));
    expect(onRowExpand).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("tree-expand-benefits")); // collapse
    expect(onRowExpand).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("tree-row-ads"));
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("respects getRowCanExpand=false and custom treeColumnId", () => {
    render(
      <TreeDataTable<Acct>
        data={data()}
        columns={columns()}
        getRowId={getRowId}
        getRowChildren={getRowChildren}
        getRowCanExpand={(r) => r.id !== "benefits"}
        treeColumnId="budget"
      />
    );
    expect(screen.queryByTestId("tree-expand-benefits")).toBeNull();
    // chevron/spacer live in the designated column
    const adsBudget = screen
      .getByTestId("tree-row-ads")
      .querySelector('[data-column-id="budget"]')!;
    expect(adsBudget.querySelector(".rfg-tree-toggle-spacer")).not.toBeNull();
  });

  it("renders the empty state for empty data", () => {
    render(
      <TreeDataTable<Acct>
        data={[]}
        columns={columns()}
        getRowId={getRowId}
        getRowChildren={getRowChildren}
        emptyMessage="Nothing here"
        showGrandTotal
      />
    );
    expect(screen.getByTestId("rfg-empty")).toHaveTextContent("Nothing here");
    expect(screen.queryByTestId("rfg-grand-total")).toBeNull();
  });
});
