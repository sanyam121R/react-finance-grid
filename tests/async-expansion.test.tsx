// bunx vitest run tests/async-expansion.test.tsx 2>&1 | tail -20
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type RowDetailStates } from "../src";
import { getRowId, makeColumns, makeData, type Dept } from "./helpers";

interface Detail {
  note: string;
}

function deferred<V>() {
  let resolve!: (v: V) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<V>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("async row expansion", () => {
  it("shows the built-in loading skeleton while the loader is pending", async () => {
    const d = deferred<Detail>();
    render(
      <DataTable<Dept, Detail>
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        loadRowDetails={() => d.promise}
        renderExpandedRow={({ detail }) => <div>note:{detail.data?.note}</div>}
      />
    );
    fireEvent.click(screen.getByTestId("expand-r0"));
    expect(screen.getByTestId("detail-loading-r0")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");

    d.resolve({ note: "ok" });
    await waitFor(() =>
      expect(screen.getByText("note:ok")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("detail-loading-r0")).not.toBeInTheDocument();
  });

  it("passes success data + status to renderExpandedRow", async () => {
    render(
      <DataTable<Dept, Detail>
        data={makeData(2)}
        columns={makeColumns()}
        getRowId={getRowId}
        loadRowDetails={async (row) => ({ note: `detail-${row.id}` })}
        renderExpandedRow={({ detail }) => (
          <div>
            {detail.status}:{detail.data?.note}
          </div>
        )}
      />
    );
    fireEvent.click(screen.getByTestId("expand-r1"));
    await waitFor(() =>
      expect(screen.getByText("success:detail-r1")).toBeInTheDocument()
    );
  });

  it("renders the built-in error UI on rejection and retries successfully", async () => {
    const loader = vi
      .fn<(row: Dept, rowId: string) => Promise<Detail>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ note: "second try" });

    render(
      <DataTable<Dept, Detail>
        data={makeData(2)}
        columns={makeColumns()}
        getRowId={getRowId}
        loadRowDetails={loader}
        renderExpandedRow={({ detail }) => <div>note:{detail.data?.note}</div>}
      />
    );
    fireEvent.click(screen.getByTestId("expand-r0"));
    await waitFor(() =>
      expect(screen.getByTestId("detail-error-r0")).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toHaveTextContent("boom");

    fireEvent.click(screen.getByTestId("detail-retry-r0"));
    await waitFor(() =>
      expect(screen.getByText("note:second try")).toBeInTheDocument()
    );
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("loads multiple expanded rows independently and concurrently", async () => {
    const a = deferred<Detail>();
    const b = deferred<Detail>();
    const loader = vi.fn((row: Dept) => (row.id === "r0" ? a.promise : b.promise));

    render(
      <DataTable<Dept, Detail>
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        expandedRowHeight={120}
        loadRowDetails={loader}
        renderExpandedRow={({ rowId, detail }) => (
          <div>
            {rowId}:{detail.data?.note}
          </div>
        )}
      />
    );
    fireEvent.click(screen.getByTestId("expand-r0"));
    fireEvent.click(screen.getByTestId("expand-r1"));
    expect(screen.getByTestId("detail-loading-r0")).toBeInTheDocument();
    expect(screen.getByTestId("detail-loading-r1")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(2);

    b.resolve({ note: "B" });
    await waitFor(() => expect(screen.getByText("r1:B")).toBeInTheDocument());
    // r0 still loading, independent of r1
    expect(screen.getByTestId("detail-loading-r0")).toBeInTheDocument();

    a.resolve({ note: "A" });
    await waitFor(() => expect(screen.getByText("r0:A")).toBeInTheDocument());
  });

  it("caches a successful load and does not refetch on re-expand", async () => {
    const loader = vi.fn(async () => ({ note: "cached" }));
    render(
      <DataTable<Dept, Detail>
        data={makeData(2)}
        columns={makeColumns()}
        getRowId={getRowId}
        loadRowDetails={loader}
        renderExpandedRow={({ detail }) => <div>note:{detail.data?.note}</div>}
      />
    );
    fireEvent.click(screen.getByTestId("expand-r0"));
    await waitFor(() => expect(screen.getByText("note:cached")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("expand-r0")); // collapse
    fireEvent.click(screen.getByTestId("expand-r0")); // expand again
    expect(screen.getByText("note:cached")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("supports custom loading and error renderers", async () => {
    const d = deferred<Detail>();
    const { rerender } = render(
      <DataTable<Dept, Detail>
        data={makeData(2)}
        columns={makeColumns()}
        getRowId={getRowId}
        loadRowDetails={() => d.promise}
        renderDetailLoading={({ rowId }) => <div>custom-loading-{rowId}</div>}
        renderExpandedRow={() => <div>done</div>}
      />
    );
    fireEvent.click(screen.getByTestId("expand-r0"));
    expect(screen.getByText("custom-loading-r0")).toBeInTheDocument();

    d.reject(new Error("nope"));
    rerender(
      <DataTable<Dept, Detail>
        data={makeData(2)}
        columns={makeColumns()}
        getRowId={getRowId}
        loadRowDetails={() => d.promise}
        renderDetailLoading={({ rowId }) => <div>custom-loading-{rowId}</div>}
        renderDetailError={({ error, reload }) => (
          <button onClick={reload}>
            custom-error-{(error as Error).message}
          </button>
        )}
        renderExpandedRow={() => <div>done</div>}
      />
    );
    await waitFor(() =>
      expect(screen.getByText("custom-error-nope")).toBeInTheDocument()
    );
  });

  it("supports fully controlled async detail states", () => {
    const onRowDetailReload = vi.fn();
    const states: RowDetailStates<Detail> = {
      r0: { status: "loading" },
      r1: { status: "error", error: new Error("controlled-fail") },
      r2: { status: "success", data: { note: "controlled-ok" } },
    };
    render(
      <DataTable<Dept, Detail>
        data={makeData(3)}
        columns={makeColumns()}
        getRowId={getRowId}
        rowDetailStates={states}
        onRowDetailReload={onRowDetailReload}
        expandedRowIds={new Set(["r0", "r1", "r2"])}
        expandedRowHeight={100}
        renderExpandedRow={({ detail }) => <div>ok:{detail.data?.note}</div>}
      />
    );
    expect(screen.getByTestId("detail-loading-r0")).toBeInTheDocument();
    expect(screen.getByTestId("detail-error-r1")).toBeInTheDocument();
    expect(screen.getByText("ok:controlled-ok")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("detail-retry-r1"));
    expect(onRowDetailReload).toHaveBeenCalledTimes(1);
    expect(onRowDetailReload.mock.calls[0]![1]).toBe("r1");
  });

  it("keeps synchronous expansion working when no loader is supplied", () => {
    render(
      <DataTable<Dept>
        data={makeData(2)}
        columns={makeColumns()}
        getRowId={getRowId}
        renderExpandedRow={({ row, detail }) => (
          <div>
            sync-{row.id}-{detail.status}
          </div>
        )}
      />
    );
    fireEvent.click(screen.getByTestId("expand-r0"));
    expect(screen.getByText("sync-r0-idle")).toBeInTheDocument();
    expect(screen.queryByTestId("detail-loading-r0")).not.toBeInTheDocument();
  });

  it("reports detail state changes via onRowDetailStatesChange", async () => {
    const onRowDetailStatesChange = vi.fn();
    render(
      <DataTable<Dept, Detail>
        data={makeData(2)}
        columns={makeColumns()}
        getRowId={getRowId}
        loadRowDetails={async () => ({ note: "x" })}
        onRowDetailStatesChange={onRowDetailStatesChange}
        renderExpandedRow={() => <div>panel</div>}
      />
    );
    fireEvent.click(screen.getByTestId("expand-r0"));
    expect(onRowDetailStatesChange).toHaveBeenCalledWith({ r0: { status: "loading" } });
    await waitFor(() =>
      expect(onRowDetailStatesChange).toHaveBeenCalledWith({
        r0: { status: "success", data: { note: "x" } },
      })
    );
  });
});