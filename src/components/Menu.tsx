import {
  useCallback,
  useEffect,
  useId,
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
  /**
   * Keep the menu open after selecting (e.g. checkbox toggles in the
   * columns panel, so users can flip several switches in one visit).
   */
  keepOpen?: boolean;
  /**
   * Return focus to the trigger after selecting (default true). Set to false
   * for actions that remove the trigger from the DOM (e.g. "Hide column") so
   * the caller can place focus itself.
   */
  restoreFocus?: boolean;
}

export interface MenuGroupDef {
  id: string;
  label?: string;
  items: MenuItemDef[];
}

const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;
const FALLBACK_MENU_WIDTH = 216;

interface MenuProps {
  open: boolean;
  onClose: () => void;
  /** Element the menu is positioned under; focus returns here on close. */
  anchorRef: RefObject<HTMLElement | null>;
  groups: MenuGroupDef[];
  label: string;
  testId?: string;
  align?: "start" | "end";
  /** Portal target (defaults to `document.body`). */
  portalContainer?: HTMLElement | null;
  /**
   * Extra class on the portal wrapper. The wrapper always carries
   * `rfg-portal` (which declares the theme variables); pass your own theme
   * class here so custom properties defined by it apply to portalled UI too.
   */
  portalClassName?: string;
  /** Element id, so the trigger can reference it with aria-controls. */
  id?: string;
}

/**
 * Minimal accessible popup menu rendered in a portal (so it escapes the
 * grid's `overflow: hidden` cells). Roving focus, Home/End, Escape-to-close
 * with focus restoration, click-outside dismissal, viewport-aware placement.
 */
export function Menu({
  open,
  onClose,
  anchorRef,
  groups,
  label,
  testId,
  align = "end",
  portalContainer,
  portalClassName,
  id,
}: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );

  const flatItems = groups.flatMap((g) => g.items);
  const enabledIndexes = flatItems
    .map((item, i) => (item.disabled ? -1 : i))
    .filter((i) => i !== -1);

  /* place the menu under the anchor, flipping/clamping inside the viewport */
  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || typeof anchor.getBoundingClientRect !== "function") return;
    const rect = anchor.getBoundingClientRect();
    const width = menu?.offsetWidth || FALLBACK_MENU_WIDTH;
    const height = menu?.offsetHeight || 0;
    const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;

    let left = align === "end" ? rect.right - width : rect.left;
    if (viewportWidth > 0) {
      left = Math.min(left, viewportWidth - width - VIEWPORT_MARGIN);
    }
    left = Math.max(VIEWPORT_MARGIN, left);

    let top = rect.bottom + MENU_GAP;
    if (
      viewportHeight > 0 &&
      height > 0 &&
      top + height > viewportHeight - VIEWPORT_MARGIN
    ) {
      // not enough room below — flip above the anchor, then clamp
      top = Math.max(VIEWPORT_MARGIN, rect.top - height - MENU_GAP);
    }

    setPosition((prev) =>
      prev && prev.top === top && prev.left === left ? prev : { top, left }
    );
  }, [anchorRef, align]);

  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition, groups]);

  /*
   * Keep the menu anchored while the page/grid scrolls or the window resizes.
   * (Dismissing instead would be flaky: focusing the trigger can itself emit a
   * scroll-into-view event in the same interaction that opened the menu.)
   */
  useEffect(() => {
    if (!open) return;
    let frame: number | null = null;
    const schedule = () => {
      if (typeof window === "undefined") return;
      if (typeof window.requestAnimationFrame !== "function") {
        updatePosition();
        return;
      }
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const anchor = anchorRef.current;
        if (!anchor || !anchor.isConnected) {
          onClose();
          return;
        }
        updatePosition();
      });
    };
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (frame !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [open, updatePosition, anchorRef, onClose]);

  /*
   * Focus the first enabled item once the menu is positioned. Until the
   * position is measured the menu is `visibility: hidden` (to avoid a
   * first-paint flash at 0,0) and hidden elements cannot receive focus in
   * real browsers — so focusing must wait for the positioned commit.
   */
  const focusedForOpenRef = useRef(false);
  useIsomorphicLayoutEffect(() => {
    if (!open) {
      focusedForOpenRef.current = false;
      return;
    }
    if (!position || focusedForOpenRef.current) return;
    const first = enabledIndexes[0];
    if (first !== undefined) {
      itemRefs.current[first]?.focus();
      focusedForOpenRef.current = true;
    }
  }, [open, position]);

  /* dismiss on scroll/resize: the menu is positioned once, so keeping it open
     while the page or grid scrolls would leave it visually detached */
    //  useEffect(() => {
    //   if (!open) return;
    //   const onScrollOrResize = (e: Event) => {
    //     if (e.type === "scroll") {
    //       const target = e.target as Node | null;
    //       // ignore scrolling *inside* the menu (long menus scroll)
    //       if (target && menuRef.current && menuRef.current.contains(target)) return;
    //     }
    //     onClose();
    //   };
    //   window.addEventListener("scroll", onScrollOrResize, true);
    //   window.addEventListener("resize", onScrollOrResize);
    //   return () => {
    //     window.removeEventListener("scroll", onScrollOrResize, true);
    //     window.removeEventListener("resize", onScrollOrResize);
    //   };
    // }, [open, onClose]);
  
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

  const closeAndRestoreFocus = useCallback(
    (restoreFocus = true) => {
      onClose();
      const anchor = anchorRef.current;
      if (restoreFocus && anchor && anchor.isConnected) anchor.focus?.();
    },
    [onClose, anchorRef]
  );

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
        // When no item has focus yet, wrap to the LAST enabled item.
        const prev =
          pos === -1
            ? enabledIndexes[enabledIndexes.length - 1]
            : enabledIndexes[(pos - 1 + enabledIndexes.length) % enabledIndexes.length];
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
    <div className={clsx("rfg-portal", portalClassName)}>
      <div
        ref={menuRef}
        id={id}
        className="rfg-menu"
        role="menu"
        aria-label={label}
        data-testid={testId}
        style={{
          top: position?.top ?? 0,
          left: position?.left ?? 0,
          // avoid a first-paint flash at (0,0) before measurement
          visibility: position ? undefined : "hidden",
        }}
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
                    if (item.keepOpen) return;
                    closeAndRestoreFocus(item.restoreFocus !== false);
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
    </div>
  );

  return createPortal(content, portalContainer ?? document.body);
}

/** Stable ids for trigger/menu `aria-controls` wiring. */
export function useMenuId(prefix: string): string {
  const id = useId();
  return `${prefix}${id}`;
}