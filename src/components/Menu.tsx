import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { clsx } from "../utils/clsx";
import { useIsomorphicLayoutEffect } from "../hooks/useIsomorphicLayoutEffect";

export interface MenuItemDef {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** Renders a checkmark / pressed state. */
  active?: boolean;
  /** `menuitemcheckbox` semantics instead of `menuitem`. */
  checkbox?: boolean;
  /** Small colour swatch (highlight actions). */
  swatch?: string;
  danger?: boolean;
}

export interface MenuGroupDef {
  id: string;
  label?: string;
  items: MenuItemDef[];
}

interface MenuProps {
  open: boolean;
  onClose: () => void;
  /** Element the menu is positioned under; focus returns here on close. */
  anchorRef: RefObject<HTMLElement | null>;
  groups: MenuGroupDef[];
  label: string;
  testId?: string;
  align?: "start" | "end";
}

/**
 * Minimal accessible popup menu rendered in a portal (so it escapes the
 * grid's `overflow: hidden` cells). Roving focus, Home/End, Escape-to-close
 * with focus restoration, click-outside dismissal.
 */
export function Menu({
  open,
  onClose,
  anchorRef,
  groups,
  label,
  testId,
  align = "end",
}: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const flatItems = groups.flatMap((g) => g.items);
  const enabledIndexes = flatItems
    .map((item, i) => (item.disabled ? -1 : i))
    .filter((i) => i !== -1);

  /* position under the anchor */
  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor || typeof anchor.getBoundingClientRect !== "function") return;
    const rect = anchor.getBoundingClientRect();
    const width = 216;
    const left =
      align === "end"
        ? Math.max(8, rect.right - width)
        : Math.max(8, rect.left);
    setPosition({ top: rect.bottom + 4, left });
  }, [open, anchorRef, align]);

  /* focus first enabled item on open */
  useEffect(() => {
    if (!open) return;
    const first = enabledIndexes[0];
    if (first !== undefined) itemRefs.current[first]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* click outside */
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: Event) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDocPointerDown, true);
    return () => document.removeEventListener("mousedown", onDocPointerDown, true);
  }, [open, onClose, anchorRef]);

  const closeAndRestoreFocus = useCallback(() => {
    onClose();
    anchorRef.current?.focus?.();
  }, [onClose, anchorRef]);

  const focusAt = (index: number) => itemRefs.current[index]?.focus();

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const active = itemRefs.current.findIndex(
      (el) => el && el === document.activeElement
    );
    const pos = enabledIndexes.indexOf(active);
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        closeAndRestoreFocus();
        break;
      case "ArrowDown": {
        e.preventDefault();
        const next = enabledIndexes[(pos + 1) % enabledIndexes.length];
        if (next !== undefined) focusAt(next);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev =
          enabledIndexes[(pos - 1 + enabledIndexes.length) % enabledIndexes.length];
        if (prev !== undefined) focusAt(prev);
        break;
      }
      case "Home": {
        e.preventDefault();
        const first = enabledIndexes[0];
        if (first !== undefined) focusAt(first);
        break;
      }
      case "End": {
        e.preventDefault();
        const last = enabledIndexes[enabledIndexes.length - 1];
        if (last !== undefined) focusAt(last);
        break;
      }
      case "Tab":
        // menus are modal-ish: closing on Tab keeps focus order sane
        closeAndRestoreFocus();
        break;
      default:
        break;
    }
  };

  if (!open || typeof document === "undefined") return null;

  let index = -1;
  const content = (
    <div
      ref={menuRef}
      className="rfg-menu"
      role="menu"
      aria-label={label}
      data-testid={testId}
      style={{ top: position.top, left: position.left }}
      onKeyDown={onKeyDown}
    >
      {groups.map((group, gi) => (
        <div
          key={group.id}
          role="group"
          aria-label={group.label}
          className="rfg-menu-group"
        >
          {gi > 0 && <div className="rfg-menu-separator" role="separator" />}
          {group.label && <div className="rfg-menu-group-label">{group.label}</div>}
          {group.items.map((item) => {
            index += 1;
            const myIndex = index;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[myIndex] = el;
                }}
                type="button"
                role={item.checkbox ? "menuitemcheckbox" : "menuitem"}
                aria-checked={item.checkbox ? Boolean(item.active) : undefined}
                aria-disabled={item.disabled || undefined}
                disabled={item.disabled}
                tabIndex={-1}
                data-testid={`menu-item-${item.id}`}
                className={clsx(
                  "rfg-menu-item",
                  item.active && "rfg-menu-item--active",
                  item.danger && "rfg-menu-item--danger"
                )}
                onClick={() => {
                  if (item.disabled) return;
                  item.onSelect();
                  closeAndRestoreFocus();
                }}
              >
                {item.swatch && (
                  <span
                    className="rfg-menu-swatch"
                    style={{ background: item.swatch }}
                    aria-hidden="true"
                  />
                )}
                <span className="rfg-menu-item-label">{item.label}</span>
                {item.active && !item.swatch && (
                  <span className="rfg-menu-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  return createPortal(content, document.body);
}