import { describe, expect, it } from "vitest";
import { flattenTree, type ChildrenSource } from "../src/utils/tree";

interface Acct {
  id: string;
  name: string;
  amount: number;
  children?: Acct[];
}

const tree: Acct[] = [
  {
    id: "benefits", name: "Benefits Expense", amount: 300,
    children: [
      { id: "8247", name: "Employee Welfare", amount: 100 },
      { id: "8725", name: "Certification Expenses", amount: 150 },
      { id: "8739", name: "Gratuity", amount: 50 },
    ],
  },
  { id: "software", name: "Software", amount: 500 },
  { id: "misc", name: "Misc. Sales", amount: 100 },
];

const getChildren = (row: Acct): ChildrenSource<Acct> =>
  row.children ? { mode: "sync", children: row.children } : { mode: "none" };
const getRowId = (r: Acct) => r.id;

describe("flattenTree", () => {
  it("collapsed: roots only, canExpand from sync children presence", () => {
    const { items, rootRows } = flattenTree({
      roots: tree, getRowId, getChildren,
      isExpanded: () => false, comparator: null, matches: null,
    });
    expect(items.map((i) => i.id)).toEqual(["benefits", "software", "misc"]);
    expect(items[0]).toMatchObject({ canExpand: true, expanded: false, depth: 0 });
    expect(items[1]).toMatchObject({ canExpand: false });
    expect(rootRows.map((r) => r.id)).toEqual(["benefits", "software", "misc"]);
  });

  it("expanded: children inline, depth + aria positions", () => {
    const { items } = flattenTree({
      roots: tree, getRowId, getChildren,
      isExpanded: (id) => id === "benefits", comparator: null, matches: null,
    });
    expect(items.map((i) => i.id)).toEqual([
      "benefits", "8247", "8725", "8739", "software", "misc",
    ]);
    expect(items[1]).toMatchObject({ depth: 1, parentId: "benefits", posInSet: 1, setSize: 3 });
    expect(items[0]).toMatchObject({ expanded: true, setSize: 3, posInSet: 1 });
  });

  it("sorts each sibling group independently (children stay under parent)", () => {
    const byAmountDesc = (a: Acct, b: Acct) => b.amount - a.amount;
    const { items } = flattenTree({
      roots: tree, getRowId, getChildren,
      isExpanded: (id) => id === "benefits", comparator: byAmountDesc, matches: null,
    });
    expect(items.map((i) => i.id)).toEqual([
      "software",           // 500
      "benefits",           // 300 — children glued beneath, sorted desc
      "8725", "8247", "8739",
      "misc",               // 100
    ]);
  });

  it("search keeps the ancestor chain and reveals matches under collapsed parents", () => {
    const { items, rootRows } = flattenTree({
      roots: tree, getRowId, getChildren,
      isExpanded: () => false, // everything collapsed
      comparator: null,
      matches: (r) => r.name.includes("Certification"),
    });
    // parent force-opened to reveal the matching branch; non-matching siblings dropped
    expect(items.map((i) => i.id)).toEqual(["benefits", "8725"]);
    expect((items[0] as { expanded: boolean }).expanded).toBe(true);
    expect(rootRows.map((r) => r.id)).toEqual(["benefits"]);
  });

  it("search: matching parent keeps its expanded subtree intact", () => {
    const { items } = flattenTree({
      roots: tree, getRowId, getChildren,
      isExpanded: (id) => id === "benefits",
      comparator: null,
      matches: (r) => r.name.includes("Benefits"),
    });
    expect(items.map((i) => i.id)).toEqual(["benefits", "8247", "8725", "8739"]);
  });

  it("async: loading and error placeholders appear under the expanded parent", () => {
    const loading = flattenTree<Acct>({
      roots: [tree[0]!], getRowId,
      getChildren: () => ({ mode: "async", status: "loading" }),
      isExpanded: () => true, comparator: null, matches: null,
    });
    expect(loading.items.map((i) => i.kind)).toEqual(["row", "children-loading"]);
    expect(loading.items[1]).toMatchObject({ parentId: "benefits", depth: 1 });

    const error = flattenTree<Acct>({
      roots: [tree[0]!], getRowId,
      getChildren: () => ({ mode: "async", status: "error", error: new Error("x") }),
      isExpanded: () => true, comparator: null, matches: null,
    });
    expect(error.items[1]).toMatchObject({ kind: "children-error" });
  });

  it("getRowCanExpand=false always wins; async rows default to expandable", () => {
    const { items } = flattenTree({
      roots: tree, getRowId,
      getChildren: () => ({ mode: "async", status: "idle" }),
      getRowCanExpand: (r) => r.id !== "misc",
      isExpanded: () => false, comparator: null, matches: null,
    });
    expect(items.map((i) => (i as { canExpand: boolean }).canExpand)).toEqual([
      true, true, false,
    ]);
  });
});
