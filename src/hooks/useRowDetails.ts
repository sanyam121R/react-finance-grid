import { useCallback, useEffect, useRef } from "react";
import type { AsyncDetailState, RowDetailStates } from "../types";
import { useControllableState } from "./useControllableState";

const IDLE: AsyncDetailState<never> = { status: "idle" };

interface Options<T, D> {
  loadRowDetails?: (
    row: T,
    rowId: string,
    ctx: { signal?: AbortSignal }
  ) => Promise<D>;
  /** Controlled states — when provided the hook never fetches. */
  rowDetailStates?: RowDetailStates<D>;
  onRowDetailStatesChange?: (states: RowDetailStates<D>) => void;
  onRowDetailReload?: (row: T, rowId: string) => void;
}

export interface RowDetailsApi<T, D> {
  /** Current state for a row (always defined; `idle` when untouched). */
  getState: (rowId: string) => AsyncDetailState<D>;
  /** Kick off a load if needed (no-op when already successful or controlled). */
  ensureLoaded: (row: T, rowId: string) => void;
  /** Force a reload (retry). */
  reload: (row: T, rowId: string) => void;
  /** Whether the grid manages async detail state. */
  isAsync: boolean;
}

/**
 * Per-row async detail state machine: idle -> loading -> success | error.
 * Rows load independently; stale responses are ignored via per-row tokens.
 */
export function useRowDetails<T, D>(opts: Options<T, D>): RowDetailsApi<T, D> {
  const { loadRowDetails, onRowDetailReload } = opts;
  const isControlled = opts.rowDetailStates !== undefined;

  const [states, setStates] = useControllableState<RowDetailStates<D>>(
    opts.rowDetailStates,
    opts.onRowDetailStatesChange,
    {}
  );

  const statesRef = useRef(states);
  statesRef.current = states;

  const tokens = useRef<Record<string, number>>({});
  const controllers = useRef<Record<string, AbortController | undefined>>({});
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // abort in-flight requests on unmount
      for (const controller of Object.values(controllers.current)) {
        controller?.abort();
      }
      controllers.current = {};
    };
  }, []);

  const patch = useCallback(
    (rowId: string, next: AsyncDetailState<D>) => {
      const merged = { ...statesRef.current, [rowId]: next };
      statesRef.current = merged;
      setStates(merged);
    },
    [setStates]
  );

  const run = useCallback(
    (row: T, rowId: string) => {
      if (!loadRowDetails) return;
      const token = (tokens.current[rowId] ?? 0) + 1;
      tokens.current[rowId] = token;
      patch(rowId, { status: "loading" });
      loadRowDetails(row, rowId).then(
        (data) => {
          if (!mounted.current || tokens.current[rowId] !== token) return;
          patch(rowId, { status: "success", data });
        },
        (error: unknown) => {
          if (!mounted.current || tokens.current[rowId] !== token) return;
          patch(rowId, { status: "error", error });
        }
      );
    },
    [loadRowDetails, patch]
  );

  const getState = useCallback(
    (rowId: string): AsyncDetailState<D> =>
      states[rowId] ?? (IDLE as AsyncDetailState<D>),
    [states]
  );

  const ensureLoaded = useCallback(
    (row: T, rowId: string) => {
      if (isControlled || !loadRowDetails) return;
      const current = statesRef.current[rowId];
      if (current && (current.status === "success" || current.status === "loading")) {
        return;
      }
      run(row, rowId);
    },
    [isControlled, loadRowDetails, run]
  );

  const reload = useCallback(
    (row: T, rowId: string) => {
      if (isControlled) {
        onRowDetailReload?.(row, rowId);
        return;
      }
      if (loadRowDetails) run(row, rowId);
      else onRowDetailReload?.(row, rowId);
    },
    [isControlled, loadRowDetails, onRowDetailReload, run]
  );

  return {
    getState,
    ensureLoaded,
    reload,
    isAsync: Boolean(loadRowDetails) || isControlled,
  };
}