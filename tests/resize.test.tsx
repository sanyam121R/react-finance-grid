import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "../src";
import { computeColumnLayout, clampWidth } from "../src/utils/layout";
import { getRowId, makeColumns, makeData } from "./helpers";

describe("column sizing (pure layout)", () => {
  const cols = [
    { id: "a", width: 100, pin: "left" as const },
    { id: "b", width: 100, pin: false as const },
    { id: "c", width: 100, pin: false as const, stretch: false },
    { id: "d", width: 100, pin: "right" as const },
  ];

  it("clamps widths to min/max", () => {
    expect(clampWidth(10, 64, 300)).toBe(64);
    expect(clampWidth(500, 64, 300)).toBe(300);
    const r = computeColumnLayout(
      [{ id: "a", width: 10, minWidth: 80, pin: false }],
      {},
      0
    );
    expect(r.columns[0]!.width).toBe(80);
  });

  it("distributes leftover space to stretch columns only", () => {
    const r = computeColumnLayout(cols, {}, 700); // base 400, extra 300
    expect(r.totalWidth).toBe(700);
    const byId = Object.fromEntries(r.columns.map((c) => [c.id, c.width]));
    expect(byId.c).toBe(100); // stretch:false untouched
    expect(byId.a! + byId.b! + byId.d!).toBe(600);
  });

  it("excludes user-resized columns from stretching", () => {
    const r = computeColumnLayout(cols, { a: 120 }, 700);
    const byId = Object.fromEntries(r.columns.map((c) => [c.id, c.width]));
    expect(byId.a).toBe(120); // override kept verbatim
  });

  it("computes left and right sticky offsets with a leading expander", () => {
    const r = computeColumnLayout(
      [
        { id: "a", width: 100, pin: "left" },
        { id: "b", width: 100, pin: "left" },
        { id: "c", width: 100, pin: false },
        { id: "d", width: 100, pin: "right" },
        { id: "e", width: 100, pin: "right" },
      ],
      {},
      0,
      40
    );
    const byId = Object.fromEntries(r.columns.map((c) => [c.id, c]));
    expect(byId.a!.offset).toBe(40);
    expect(byId.b!.offset).toBe(140);
    expect(byId.b!.isLastLeftPinned).toBe(true);
    expect(byId.e!.offset).toBe(0); // outermost right
    expect(byId.d!.offset).toBe(100);
    expect(byId.d!.isFirstRightPinned).toBe(true);
    expect(r.totalWidth).toBe(40 + 500);
  });

  it("respects maxWidth while stretching", () => {
    const r = computeColumnLayout(
      [{ id: "a", width: 100, maxWidth: 150, pin: false }],
      {},
      1000
    );
    expect(r.columns[0]!.width).toBe(150);
  });
});

describe("column sizing (DOM)", () => {
  it("resizes via keyboard on the resize handle", () => {
    render(
      <DataTable data={makeData(3)} columns={makeColumns()} getRowId={getRowId} />
    );
    const header = () =>
      document.querySelector('.rfg-header [data-column-id="name"]') as HTMLElement;
    expect(header().style.width).toBe("150px");
    const handle = screen.getByTestId("resize-name");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(header().style.width).toBe("166px"); // +16 step
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(header().style.width).toBe("134px");
  });

  it("resizes via pointer drag and clamps at minWidth", () => {
    const cols = makeColumns();
    cols[0]!.minWidth = 120;
    render(<DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />);
    const header = () =>
      document.querySelector('.rfg-header [data-column-id="name"]') as HTMLElement;

    fireEvent.pointerDown(screen.getByTestId("resize-name"), { clientX: 200 });
    fireEvent(window, new MouseEvent("pointermove", { clientX: 260 }));
    expect(header().style.width).toBe("210px"); // 150 + 60
    fireEvent(window, new MouseEvent("pointermove", { clientX: 0 }));
    expect(header().style.width).toBe("120px"); // clamped to minWidth
    fireEvent(window, new MouseEvent("pointerup"));
  });

  it("hides the handle when resizable=false", () => {
    const cols = makeColumns();
    cols[0]!.resizable = false;
    render(<DataTable data={makeData(3)} columns={cols} getRowId={getRowId} />);
    expect(screen.queryByTestId("resize-name")).not.toBeInTheDocument();
  });
});