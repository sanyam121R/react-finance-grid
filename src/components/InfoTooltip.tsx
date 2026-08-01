import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { clsx } from "../utils/clsx";
import { useIsomorphicLayoutEffect } from "../hooks/useIsomorphicLayoutEffect";

const TIP_GAP = 8;
const VIEWPORT_MARGIN = 8;
const FALLBACK_TIP_WIDTH = 240;

export interface InfoTooltipProps {
  /** Tooltip body — any ReactNode, interactive content supported. */
  content: ReactNode;
  /** Accessible name for the ⓘ trigger (default "Row details"). */
  label?: string;
  /** Preferred side (default "top"); flips automatically when space runs out. */
  placement?: "top" | "bottom";
  /**
   * Hover intent delays in ms. Focus/blur always act immediately so keyboard
   * users are never throttled. `closeDelay` > 0 keeps the tooltip reachable
   * while the pointer travels into it (interactive content).
   */
  openDelay?: number;
  closeDelay?: number;
  /** Portal target (defaults to `document.body`). */
  portalContainer?: HTMLElement | null;
  /** Theme class propagated to the portalled tooltip. */
  portalClassName?: string;
  /** Extra class on the trigger button. */
  className?: string;
  testId?: string;
}

/**
 * Accessible "ⓘ" info tooltip rendered in a portal (escapes the grid's
 * `overflow: hidden` cells). Opens on hover (with intent delay) and on
 * keyboard focus (immediately); closes on blur, Escape or pointer-out with a
 * grace period so interactive content (links, buttons) stays reachable.
 */
export function InfoTooltip({
  content,
  label = "Row details",
  placement = "top",
  openDelay = 100,
  closeDelay = 150,
  portalContainer,
  portalClassName,
  className,
  testId,
}: InfoTooltipProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    side: "top" | "bottom";
    arrowLeft: number;
  } | null>(null);
  const tipId = useId();

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) clearTimeout(openTimer.current);
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const show = useCallback(
    (delay: number) => {
      clearTimers();
      if (delay <= 0) setOpen(true);
      else openTimer.current = setTimeout(() => setOpen(true), delay);
    },
    [clearTimers]
  );
  const hide = useCallback(
    (delay: number) => {
      clearTimers();
      if (delay <= 0) setOpen(false);
      else closeTimer.current = setTimeout(() => setOpen(false), delay);
    },
    [clearTimers]
  );

  /* place above/below the trigger, centered, clamped to the viewport */
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof trigger.getBoundingClientRect !== "function") return;
    const rect = trigger.getBoundingClientRect();
    const tip = tipRef.current;
    const width = tip?.offsetWidth || FALLBACK_TIP_WIDTH;
    const height = tip?.offsetHeight || 0;
    const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;

    let side: "top" | "bottom" = placement;
    if (side === "top" && rect.top - height - TIP_GAP < VIEWPORT_MARGIN) {
      side = "bottom";
    } else if (
      side === "bottom" &&
      typeof window !== "undefined" &&
      rect.bottom + height + TIP_GAP > window.innerHeight - VIEWPORT_MARGIN
    ) {
      side = "top";
    }

    const triggerCenter = rect.left + rect.width / 2;
    let left = triggerCenter - width / 2;
    if (viewportWidth > 0) {
      left = Math.min(left, viewportWidth - width - VIEWPORT_MARGIN);
    }
    left = Math.max(VIEWPORT_MARGIN, left);
    const top =
      side === "top" ? rect.top - height - TIP_GAP : rect.bottom + TIP_GAP;
    const arrowLeft = Math.max(10, Math.min(triggerCenter - left, width - 10));

    setPosition((prev) =>
      prev &&
        prev.top === top &&
        prev.left === left &&
        prev.side === side &&
        prev.arrowLeft === arrowLeft
        ? prev
        : { top, left, side, arrowLeft }
    );
  }, [placement]);

  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition, content]);

  /* keep anchored while the grid/page scrolls or the window resizes */
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
        const trigger = triggerRef.current;
        if (!trigger || !trigger.isConnected) {
          setOpen(false);
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
  }, [open, updatePosition]);

  /* Escape dismisses from anywhere (tooltip content may hold focus) */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        clearTimers();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, clearTimers]);

  const tip =
    open && typeof document !== "undefined"
      ? createPortal(
        <div className={clsx("rfg-portal", portalClassName)}>
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            data-testid={testId ? `${testId}-tooltip` : undefined}
            className={clsx(
              "rfg-tooltip",
              position && `rfg-tooltip--${position.side}`
            )}
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              // avoid a first-paint flash at (0,0) before measurement
              visibility: position ? undefined : "hidden",
            }}
            onMouseEnter={() => show(0)}
            onMouseLeave={() => hide(closeDelay)}
            onBlur={(e) => {
              // close once focus leaves both the tooltip and its trigger
              const next = e.relatedTarget as Node | null;
              if (tipRef.current?.contains(next)) return;
              if (triggerRef.current?.contains(next)) return;
              hide(0);
            }}
          >
            {content}
            <span
              className="rfg-tooltip-arrow"
              aria-hidden="true"
              style={{ left: position?.arrowLeft ?? "50%" }}
            />
          </div>
        </div>,
        portalContainer ?? document.body
      )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={clsx("rfg-icon-btn rfg-info-btn", open && "rfg-icon-btn--active", className)}
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        data-testid={testId}
        onMouseEnter={() => show(openDelay)}
        onMouseLeave={() => hide(closeDelay)}
        onFocus={() => show(0)}
        onBlur={(e) => {
          // keep open while focus (Tab or click) moves into the tooltip body,
          // so interactive content like "View details" links stays usable
          if (tipRef.current?.contains(e.relatedTarget as Node | null)) return;
          hide(0);
        }}
        onClick={(e) => {
          // row onClick must not fire when inspecting details
          e.stopPropagation();
          clearTimers();
          setOpen((v) => !v);
        }}
      >
        <InfoIcon />
      </button>
      {tip}
    </>
  );
}

export const InfoIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="8" cy="5.2" r="0.9" fill="currentColor" />
    <path d="M8 7.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);