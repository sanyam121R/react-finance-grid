import type { DetailStatus } from "../types";

/* ------------------------------------------------------------------ */
/* Pure tree flattening: sort per sibling group, filter tree-aware,    */
/* emit a flat list the virtualizer can window.                        */
/* ------------------------------------------------------------------ */

/** A data row in the flattened tree. */
export interface FlatTreeRow<T> {
  kind: "row";
  row: T;
  id: string;
  depth: number;
  parentId: string | null;
  canExpand: boolean;
  /** Effective expansion (may be forced open to reveal search matches). */
  expanded: boolean;
  /** 1-based position among the rendered siblings (aria-posinset). */
  posInSet: number;
  /** Number of rendered siblings (aria-setsize). */
  setSize: number;
}

/** Transient placeholder row shown while async children load / after failure. */
export interface FlatTreePlaceholder<T> {
  kind: "children-loading" | "children-error";
  id: string;
  parentRow: T;
  parentId: string;
  /** Depth of the children it stands in for (parent depth + 1). */
  depth: number;
  error?: unknown;
}

export type FlatTreeItem<T> = FlatTreeRow<T> | FlatTreePlaceholder<T>;

/** How a row's children are resolved. */
export type ChildrenSource<T> =
  | { mode: "none" }
  | { mode: "sync"; children: readonly T[] }
  | {
      mode: "async";
      status: DetailStatus;
      children?: readonly T[];
      error?: unknown;
    };

export interface FlattenTreeOptions<T> {
  roots: readonly T[];
  /** Stable unique id; `index` is the position within the sibling group. */
  getRowId: (row: T, index: number) => string;
  getChildren: (row: T, rowId: string) => ChildrenSource<T>;
  /** Consumer override; `false` always wins. */
  getRowCanExpand?: (row: T) => boolean;
  isExpanded: (rowId: string) => boolean;
  /** Ascending-chain comparator applied independently to every sibling group. */
  comparator: ((a: T, b: T) => number) | null;
  /**
   * Search predicate, or `null` when not searching. While searching, a row is
   * kept when it matches, has a matching descendant (its chain stays visible
   * and matching branches are revealed even under collapsed parents), or has
   * a matching ancestor (subtree of a match stays intact when expanded).
   */
  matches: ((row: T) => boolean) | null;
}

export interface FlattenTreeResult<T> {
  items: FlatTreeItem<T>[];
  /** Root rows that survived filtering (grand-total input). */
  rootRows: T[];
}

export function flattenTree<T>(opts: FlattenTreeOptions<T>): FlattenTreeResult<T> {
  const {
    roots,
    getRowId,
    getChildren,
    getRowCanExpand,
    isExpanded,
    comparator,
    matches,
  } = opts;

  const rootRows: T[] = [];

  interface WalkResult {
    items: FlatTreeItem<T>[];
    anyMatch: boolean;
  }

  const walk = (
    rows: readonly T[],
    depth: number,
    parentId: string | null,
    ancestorMatch: boolean
  ): WalkResult => {
    const sorted = comparator ? [...rows].sort(comparator) : rows;
    const kept: Array<{ node: FlatTreeRow<T>; trailing: FlatTreeItem<T>[] }> = [];
    let anyMatch = false;

    sorted.forEach((row, index) => {
      const id = getRowId(row, index);
      const source = getChildren(row, id);

      const overridden = getRowCanExpand?.(row);
      const canExpand =
        overridden === false
          ? false
          : source.mode === "sync"
            ? source.children.length > 0
            : source.mode === "async"
              ? (overridden ?? true)
              : (overridden ?? false);

      const loadedChildren: readonly T[] | undefined =
        source.mode === "sync"
          ? source.children
          : source.mode === "async" && source.status === "success"
            ? source.children
            : undefined;

      const own = matches ? matches(row) : false;
      const userExpanded = canExpand && isExpanded(id);

      // While searching, always walk loaded children to detect matches even
      // under collapsed parents; otherwise only walk expanded branches.
      let childResult: WalkResult | null = null;
      if (
        loadedChildren &&
        loadedChildren.length > 0 &&
        (userExpanded || matches !== null)
      ) {
        childResult = walk(loadedChildren, depth + 1, id, ancestorMatch || own);
      }

      const descendantMatch = childResult?.anyMatch ?? false;
      const keep = matches === null || own || ancestorMatch || descendantMatch;
      if (!keep) return;
      anyMatch = anyMatch || own || descendantMatch;

      // Reveal matching branches under collapsed parents during a search.
      const forcedOpen = matches !== null && !userExpanded && descendantMatch;
      const expanded = userExpanded || forcedOpen;

      const trailing: FlatTreeItem<T>[] = [];
      if (expanded) {
        if (source.mode === "async" && userExpanded) {
          if (source.status === "idle" || source.status === "loading") {
            trailing.push({
              kind: "children-loading",
              id: `${id}::children-loading`,
              parentRow: row,
              parentId: id,
              depth: depth + 1,
            });
          } else if (source.status === "error") {
            trailing.push({
              kind: "children-error",
              id: `${id}::children-error`,
              parentRow: row,
              parentId: id,
              depth: depth + 1,
              error: source.error,
            });
          }
        }
        if (childResult) {
          // When the user expanded the branch outside a search, or the branch
          // is visible through a match, include the (already filtered) items.
          trailing.push(...childResult.items);
        }
      }

      const node: FlatTreeRow<T> = {
        kind: "row",
        row,
        id,
        depth,
        parentId,
        canExpand,
        expanded: expanded && canExpand,
        posInSet: 0, // assigned below once the kept set is known
        setSize: 0,
      };
      kept.push({ node, trailing });
      if (depth === 0) rootRows.push(row);
    });

    const items: FlatTreeItem<T>[] = [];
    kept.forEach((entry, i) => {
      entry.node.posInSet = i + 1;
      entry.node.setSize = kept.length;
      items.push(entry.node, ...entry.trailing);
    });
    return { items, anyMatch };
  };

  const { items } = walk(roots, 0, null, false);
  return { items, rootRows };
}