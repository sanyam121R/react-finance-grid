/* Validates the built package surface: ESM, CJS, types and CSS. */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);

// CJS
const cjs = require("../dist/index.cjs");
assert.equal(typeof cjs.DataTable, "function", "CJS DataTable export");
assert.equal(typeof cjs.TableSkeleton, "function", "CJS TableSkeleton export");

// ESM
const esm = await import("../dist/index.js");
assert.equal(typeof esm.DataTable, "function", "ESM DataTable export");
assert.equal(typeof esm.TableSkeleton, "function", "ESM TableSkeleton export");

// Types + CSS artifacts
for (const f of ["dist/index.d.ts", "dist/index.d.cts", "dist/styles.css"]) {
  assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} exists`);
}
const dts = readFileSync(new URL("../dist/index.d.ts", import.meta.url), "utf8");
for (const name of ["DataTable", "TableSkeleton", "ColumnDef", "DataTableProps", "SortState", "ColumnPinningState"]) {
  assert.ok(dts.includes(name), `d.ts mentions ${name}`);
}
const css = readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8");
assert.ok(css.includes(".rfg-root"), "CSS contains theme root");

// package.json exports map sanity
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
assert.ok(pkg.exports["./styles.css"], "styles.css export mapped");

console.log("exports OK: ESM + CJS + types + CSS verified");