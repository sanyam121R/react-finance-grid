import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// jsdom does not implement PointerEvent; a MouseEvent subclass is sufficient
// for the resize-drag interactions under test.
if (typeof globalThis.PointerEvent === "undefined") {
  (globalThis as unknown as { PointerEvent: unknown }).PointerEvent =
    class PointerEvent extends MouseEvent {};
}