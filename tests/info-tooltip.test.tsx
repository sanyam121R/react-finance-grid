import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InfoTooltip, TreeDataTable, type TreeColumnDef } from "../src";

describe("InfoTooltip — standalone", () => {
  it("opens on keyboard focus immediately and wires aria-describedby", () => {
    render(<InfoTooltip content={<div>breakdown</div>} label="Amount details" testId="tip" />);
    const trigger = screen.getByTestId("tip");
    expect(trigger).toHaveAccessibleName("Amount details");
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.focus(trigger);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("breakdown");
    expect(trigger).toHaveAttribute("aria-describedby", tip.id);

    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(trigger).not.toHaveAttribute("aria-describedby");
  });

  it("closes on Escape", () => {
    render(<InfoTooltip content="info" testId="tip" />);
    fireEvent.focus(screen.getByTestId("tip"));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("toggles on click (touch support) without bubbling to the row", () => {
    const rowClick = vi.fn();
    render(
      <div onClick={rowClick}>
        <InfoTooltip content="info" testId="tip" />
      </div>
    );
    fireEvent.click(screen.getByTestId("tip"));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(rowClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("tip"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  describe("hover intent (fake timers)", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("opens after openDelay and stays open while hovering the tooltip body", () => {
      render(
        <InfoTooltip
          content={<a href="#d">View Details</a>}
          openDelay={100}
          closeDelay={150}
          testId="tip"
        />
      );
      const trigger = screen.getByTestId("tip");
      fireEvent.mouseEnter(trigger);
      expect(screen.queryByRole("tooltip")).toBeNull(); // intent delay
      act(() => vi.advanceTimersByTime(100));
      const tip = screen.getByRole("tooltip");

      // pointer travels from trigger into the tooltip: close is scheduled…
      fireEvent.mouseLeave(trigger);
      act(() => vi.advanceTimersByTime(100)); // within the grace period
      fireEvent.mouseEnter(tip); // …and cancelled — interactive content reachable
      act(() => vi.advanceTimersByTime(500));
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
      expect(screen.getByText("View Details")).toBeInTheDocument();

      fireEvent.mouseLeave(screen.getByRole("tooltip"));
      act(() => vi.advanceTimersByTime(150));
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("never opens when the pointer leaves before the intent delay", () => {
      render(<InfoTooltip content="info" openDelay={100} closeDelay={0} testId="tip" />);
      const trigger = screen.getByTestId("tip");
      fireEvent.mouseEnter(trigger);
      act(() => vi.advanceTimersByTime(50));
      fireEvent.mouseLeave(trigger);
      act(() => vi.advanceTimersByTime(500));
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });
});

describe("InfoTooltip — inside TreeDataTable", () => {
  interface Acct { id: string; name: string; amount: number }
  const rows: Acct[] = [
    { id: "8725", name: "Certification Expenses", amount: 150 },
    { id: "8739", name: "Gratuity", amount: 50 },
  ];
  const columns: TreeColumnDef<Acct>[] = [
    { id: "name", header: "Account", accessorKey: "name" },
    {
      id: "amount",
      header: "Amount",
      accessorKey: "amount",
      // per-row details, only where data exists — like the design's breakdown
      infoTip: (row) =>
        row.id === "8725" ? (
          <dl>
            <dt>India</dt><dd>$2021</dd>
            <dt>UK</dt><dd>$1000</dd>
          </dl>
        ) : null,
      infoTipLabel: "Amount breakdown",
    },
  ];

  it("renders the info icon only for rows with tooltip content", () => {
    render(
      <TreeDataTable<Acct>
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        getRowChildren={() => null}
      />
    );
    expect(screen.getByTestId("info-amount-8725")).toBeInTheDocument();
    expect(screen.queryByTestId("info-amount-8739")).toBeNull();
  });

  it("shows the row-specific breakdown on focus", () => {
    render(
      <TreeDataTable<Acct>
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        getRowChildren={() => null}
      />
    );
    fireEvent.focus(screen.getByTestId("info-amount-8725"));
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("India");
    expect(tip).toHaveTextContent("$2021");
    expect(screen.getByTestId("info-amount-8725")).toHaveAccessibleName("Amount breakdown");
  });
});
