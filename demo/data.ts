export interface QuarterDetail {
  quarter: string;
  budget: number;
  actual: number;
}

export interface DeptRow {
  id: string;
  department: string;
  costCenter: string;
  owner: string;
  region: string;
  budget: number;
  actual: number;
  variance: number;
  status: "On track" | "At risk" | "Over budget";
  quarters: QuarterDetail[];
}

const DEPARTMENTS = [
  "Engineering",
  "Marketing",
  "Sales",
  "Finance",
  "Operations",
  "HR",
  "Legal",
  "IT",
];
const REGIONS = ["NA", "EMEA", "APAC", "LATAM"];
const STATUSES: DeptRow["status"][] = ["On track", "At risk", "Over budget"];

/** Simulated async detail endpoint used by the demo's `loadRowDetails`. */
export function fetchQuarterDetails(
  row: DeptRow,
  failRate = 0.2,
  delayMs = 650
): Promise<QuarterDetail[]> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < failRate) {
        reject(new Error(`Request failed for ${row.costCenter} (simulated)`));
        return;
      }
      resolve(row.quarters);
    }, delayMs);
  });
}

/** Deterministic PRNG so the demo is reproducible. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export function makeDemoData(count = 5000): DeptRow[] {
  const rand = seeded(42);
  return Array.from({ length: count }, (_, i) => {
    const budget = Math.round(rand() * 900_000 + 100_000);
    const actual = Math.round(budget * (0.55 + rand() * 0.7));
    const quarters: QuarterDetail[] = [1, 2, 3, 4].map((q) => {
      const qb = Math.round(budget / 4);
      return {
        quarter: `Q${q} 2025`,
        budget: qb,
        actual: Math.round(qb * (0.5 + rand() * 0.8)),
      };
    });
    return {
      id: `dept-${i}`,
      department: `${DEPARTMENTS[i % DEPARTMENTS.length]} ${Math.floor(i / DEPARTMENTS.length) + 1}`,
      costCenter: `CC-${3000 + i}`,
      owner: `Owner ${(i * 7) % 97}`,
      region: REGIONS[i % REGIONS.length]!,
      budget,
      actual,
      variance: budget - actual,
      status: STATUSES[i % 3]!,
      quarters,
    };
  });
}

export const usd = (n: number): string =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });