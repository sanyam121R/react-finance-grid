/* Validates the built package surface: ESM, CJS, types and CSS. */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);

const HELPERS = [
  "serializeLayout",
  "parseLayout",
  "reconcileLayout",
  "createEmptyLayout",
  "formatCurrency",
  "createCurrencyFormatter",
  "formatPercent",
  "formatNumber",
  "formatVariance",
  "cycleSingleSort",
  "cycleMultiSort",
  "addSort",
  "removeSort",
  "setSingleSort",
  "makeSortComparator",
];

// CJS
const cjs = require("../dist/index.cjs");
// DataTable is a forwardRef component (object with $$typeof)
assert.ok(cjs.DataTable, "CJS DataTable export");
assert.equal(typeof cjs.TableSkeleton, "function", "CJS TableSkeleton export");
assert.equal(typeof cjs.LAYOUT_VERSION, "number", "CJS LAYOUT_VERSION export");
for (const name of HELPERS) {
  assert.equal(typeof cjs[name], "function", `CJS helper ${name}`);
}

// ESM
const esm = await import("../dist/index.js");
assert.ok(esm.DataTable, "ESM DataTable export");
assert.equal(typeof esm.TableSkeleton, "function", "ESM TableSkeleton export");
for (const name of HELPERS) {
  assert.equal(typeof esm[name], "function", `ESM helper ${name}`);
}

// round-trip a layout through the built helpers
const layout = { ...esm.createEmptyLayout(), columnOrder: ["a", "b"] };
assert.deepEqual(esm.parseLayout(esm.serializeLayout(layout)), layout, "layout round-trip");
assert.equal(esm.parseLayout("garbage"), null, "layout rejects garbage");
assert.equal(esm.formatCurrency(1234.56, { locale: "en-US" }), "$1,235", "formatCurrency");

// Types + CSS artifacts
for (const f of ["dist/index.d.ts", "dist/index.d.cts", "dist/styles.css"]) {
  assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} exists`);
}
const dts = readFileSync(new URL("../dist/index.d.ts", import.meta.url), "utf8");
for (const name of [
  "DataTable",
  "TableSkeleton",
  "ColumnDef",
  "DataTableProps",
  "DataTableHandle",
  "SortState",
  "ColumnPinningState",
  "ColumnOrderState",
  "ColumnVisibilityState",
  "ColumnHighlightState",
  "HighlightColor",
  "GridLayoutState",
  "AsyncDetailState",
  "RowDetailStates",
  "Density",
]) {
  assert.ok(dts.includes(name), `d.ts mentions ${name}`);
}
const css = readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8");
for (const sel of [".rfg-root", ".rfg-menu", ".rfg-cell--hl-blue", ".rfg-grip", ".rfg-detail-error", ".rfg-root--compact"]) {
  assert.ok(css.includes(sel), `CSS contains ${sel}`);
}

// react / react-dom must stay external (peer deps, tree-shakeable output)
const esmSrc = readFileSync(new URL("../dist/index.js", import.meta.url), "utf8");
assert.ok(/from ?[\'"]react[\'"]/.test(esmSrc), "react kept external in ESM build");
assert.ok(/from ?[\'"]react-dom[\'"]/.test(esmSrc), "react-dom kept external in ESM build");
assert.ok(!esmSrc.includes("__REACT_DEVTOOLS_GLOBAL_HOOK__"), "react not inlined");

// package.json exports map sanity
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
assert.ok(pkg.exports["./styles.css"], "styles.css export mapped");

console.log("exports OK: ESM + CJS + types + CSS verified");