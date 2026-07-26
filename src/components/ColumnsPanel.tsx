import { useMemo, useRef, useState } from "react";
import type { ColumnDef } from "../types";
import { ColumnsIcon } from "./icons";
import { Menu, type MenuGroupDef } from "./Menu";
import { clsx } from "../utils/clsx";

interface ColumnsPanelProps<T> {
  /** Columns in user order, including hidden ones. */
  columns: ColumnDef<T>[];
  isVisible: (columnId: string) => boolean;
  onToggle: (columnId: string) => void;
  onShowAll: () => void;
  onResetLayout: () => void;
  label?: string;
}

/** Toolbar menu for column visibility + layout reset. */
export function ColumnsPanel<T>({
  columns,
  isVisible,
  onToggle,
  onShowAll,
  onResetLayout,
  label = "Columns",
}: ColumnsPanelProps<T>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const groups = useMemo<MenuGroupDef[]>(
    () => [
      {
        id: "visibility",
        label: "Visible columns",
        items: columns.map((c) => ({
          id: `visibility-${c.id}`,
          label:
            c.label ?? (typeof c.header === "string" ? c.header : c.id),
          checkbox: true,
          active: isVisible(c.id),
          disabled: c.hideable === false,
          onSelect: () => onToggle(c.id),
        })),
      },
      {
        id: "actions",
        items: [
          { id: "show-all-columns", label: "Show all columns", onSelect: onShowAll },
          { id: "reset-layout", label: "Reset layout", onSelect: onResetLayout },
        ],
      },
    ],
    [columns, isVisible, onToggle, onShowAll, onResetLayout]
  );

  const hiddenCount = columns.filter((c) => !isVisible(c.id)).length;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={clsx("rfg-btn", open && "rfg-btn--active")}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="rfg-columns-panel-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <ColumnsIcon />
        <span>{label}</span>
        {hiddenCount > 0 && <span className="rfg-badge">{hiddenCount} hidden</span>}
      </button>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        groups={groups}
        label="Column visibility"
        testId="rfg-columns-panel"
        align="start"
      />
    </>
  );
}