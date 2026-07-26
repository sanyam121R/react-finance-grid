import type { ColumnDef } from "../src";

export interface Dept {
  id: string;
  name: string;
  region: string;
  budget: number;
  actual: number;
}

export function makeData(count = 5): Dept[] {
  const names = ["Engineering", "Marketing", "Sales", "Finance", "Operations"];
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    name: `${names[i % names.length]} ${i}`,
    region: i % 2 === 0 ? "EMEA" : "APAC",
    budget: (i + 1) * 100,
    actual: (i + 1) * 90,
  }));
}

export function makeColumns(): ColumnDef<Dept>[] {
  return [
    { id: "name", header: "Department", accessorKey: "name", width: 150 },
    { id: "region", header: "Region", accessorKey: "region", width: 100 },
    {
      id: "budget",
      header: "Budget",
      accessorKey: "budget",
      align: "right",
      aggregate: "sum",
      width: 120,
    },
    {
      id: "actual",
      header: "Actual",
      accessorFn: (r) => r.actual,
      align: "right",
      aggregate: "sum",
      width: 120,
    },
  ];
}

export const getRowId = (r: Dept) => r.id;