import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TreeDataTable, type RowChildrenStates, type TreeColumnDef } from "../src";

interface Acct {
  id: string;
  name: string;
  amount: number;
}

const roots: Acct[] = [
  { id: "benefits", name: "Benefits Expense", amount: 300 },
  { id: "software", name: "Software", amount: 500 },
];

const kids: Acct[] = [
  { id: "8247", name: "Employee Welfare", amount: 100 },
  { id: "8725", name: "Certification Expenses", amount: 150 },
];

const columns = (): TreeColumnDef<Acct>[] => [
  { id: "name", header: "Account", accessorKey: "name" },
  { id: "amount", header: "Amount", accessorKey: "amount", align: "right" },
];
const getRowId = (r: Acct) => r.id;

function deferred<V>() {
  let resolve!: (v: V) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<V>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("TreeDataTable — async children", () => {
  it("shows an inline loading row, then the children as table rows", async () => {
    const d = deferred<Acct[]>();
    render(
      <TreeDataTable<Acct>
        data={roots}
        columns={columns()}
        getRowId={getRowId}
        loadRowChildren={() => d.promise}
      />
    );
    fireEvent.click(screen.getByTestId("tree-expand-benefits"));
    expect(screen.getByTestId("tree-children-loading-benefits")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");

    d.resolve(kids);
    await waitFor(() =>
      expect(screen.getByTestId("tree-row-8725")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("tree-children-loading-benefits")).toBeNull();
    expect(screen.getByTestId("tree-row-8725")).toHaveAttribute("aria-level", "2");
  });

  it("passes the documented ctx.signal and aborts on unmount", () => {
    const signals: AbortSignal[] = [];
    const { unmount } = render(
      <TreeDataTable<Acct>
        data={roots}
        columns={columns()}
        getRowId={getRowId}
        loadRowChildren={(_row, _id, ctx) =>
          new Promise<Acct[]>(() => {
            if (ctx.signal) signals.push(ctx.signal);
          })
        }
      />
    );
    fireEvent.click(screen.getByTestId("tree-expand-benefits"));
    expect(signals[0]?.aborted).toBe(false);
    unmount();
    expect(signals[0]?.aborted).toBe(true);
  });

  it("renders an inline error row and retries successfully", async () => {
    const loader = vi
      .fn<(row: Acct, rowId: string, ctx: { signal?: AbortSignal }) => Promise<Acct[]>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(kids);
    render(
      <TreeDataTable<Acct>
        data={roots}
        columns={columns()}
        getRowId={getRowId}
        loadRowChildren={loader}
      />
    );
    fireEvent.click(screen.getByTestId("tree-expand-benefits"));
    await waitFor(() =>
      expect(screen.getByTestId("tree-children-error-benefits")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId("tree-children-retry-benefits"));
    await waitFor(() =>
      expect(screen.getByTestId("tree-row-8247")).toBeInTheDocument()
    );
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("caches loaded children — no refetch on re-expand", async () => {
    const loader = vi.fn(async () => kids);
    render(
      <TreeDataTable<Acct>
        data={roots}
        columns={columns()}
        getRowId={getRowId}
        loadRowChildren={loader}
      />
    );
    fireEvent.click(screen.getByTestId("tree-expand-benefits"));
    await waitFor(() => expect(screen.getByTestId("tree-row-8247")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("tree-expand-benefits")); // collapse
    fireEvent.click(screen.getByTestId("tree-expand-benefits")); // expand again
    expect(screen.getByTestId("tree-row-8247")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("supports custom loading/error renderers with collapse + reload", async () => {
    const d = deferred<Acct[]>();
    render(
      <TreeDataTable<Acct>
        data={roots}
        columns={columns()}
        getRowId={getRowId}
        loadRowChildren={() => d.promise}
        renderChildrenLoading={({ rowId, collapse }) => (
          <button data-testid={`cancel-${rowId}`} onClick={collapse}>
            loading…cancel
          </button>
        )}
      />
    );
    fireEvent.click(screen.getByTestId("tree-expand-benefits"));
    fireEvent.click(screen.getByTestId("cancel-benefits"));
    // collapsed again — placeholder gone
    expect(screen.queryByTestId("tree-children-loading-benefits")).toBeNull();
    expect(screen.getByTestId("tree-row-benefits")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("supports fully controlled children states", () => {
    const onReload = vi.fn();
    const states: RowChildrenStates<Acct> = {
      benefits: { status: "success", data: kids },
      software: { status: "error", error: new Error("nope") },
    };
    render(
      <TreeDataTable<Acct>
        data={roots}
        columns={columns()}
        getRowId={getRowId}
        rowChildrenStates={states}
        onRowChildrenReload={onReload}
        expandedRowIds={new Set(["benefits", "software"])}
      />
    );
    expect(screen.getByTestId("tree-row-8725")).toBeInTheDocument();
    expect(screen.getByTestId("tree-children-error-software")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tree-children-retry-software"));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onReload.mock.calls[0]![1]).toBe("software");
  });

  it("getRowChildren takes precedence over loadRowChildren (documented)", () => {
    const loader = vi.fn(async () => kids);
    render(
      <TreeDataTable<Acct>
        data={[{ id: "p", name: "Parent", amount: 1 }]}
        columns={columns()}
        getRowId={getRowId}
        getRowChildren={() => kids}
        loadRowChildren={loader}
      />
    );
    fireEvent.click(screen.getByTestId("tree-expand-p"));
    expect(screen.getByTestId("tree-row-8247")).toBeInTheDocument();
    expect(loader).not.toHaveBeenCalled();
  });
});
