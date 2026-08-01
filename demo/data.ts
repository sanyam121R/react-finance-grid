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

/** Simulated async detail endpoint used by the demo's `loadRowDetails`.
    Honours `AbortSignal` (v0.2.1: the grid aborts superseded/unmounted
    requests) and reports aborts so the demo can visualize them. */
export function fetchQuarterDetails(
  row: DeptRow,
  options: {
    signal?: AbortSignal;
    failRate?: number;
    delayMs?: number;
    onAbort?: () => void;
  } = {}
): Promise<QuarterDetail[]> {
  const { signal, failRate = 0.2, delayMs = 650, onAbort } = options;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (Math.random() < failRate) {
        reject(new Error(`Request failed for ${row.costCenter} (simulated)`));
        return;
      }
      resolve(row.quarters);
    }, delayMs);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      onAbort?.();
      reject(new DOMException("Aborted", "AbortError"));
    });
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
/* ================================================================== */
/* v0.3.0 — hierarchical expense accounts (TreeDataTable demo)         */
/* Mirrors the reference design: parents carry totals, children are a  */
/* continuation of the table under the same column headings.           */
/* ================================================================== */

export interface RegionAmount {
  region: string;
  amount: number;
}

export interface ExpenseAccount {
  id: string;
  /** GL code shown for sub-accounts (e.g. 8247). */
  code?: string;
  name: string;
  fy2025: number;
  fy2024: number;
  /** Per-region breakdown rendered inside the ⓘ tooltip. */
  regionBreakdown?: RegionAmount[];
  /** Rows with a comprehensive-details page get a "View Details ›" tooltip. */
  hasDetails?: boolean;
  children?: ExpenseAccount[];
}

const acct = (
  id: string,
  name: string,
  fy2025: number,
  fy2024: number,
  extra: Partial<ExpenseAccount> = {}
): ExpenseAccount => ({ id, name, fy2025, fy2024, ...extra });;

export function makeExpenseTree(): ExpenseAccount[] {
  return [
    acct("advertising", "Advertising Expense", 2, 2),
    acct("benefits", "Benefits Expense", 63_854_406, 58_120_900, {
      hasDetails: true,
      children: [
        acct("8247", "Employee Welfare", 12_410_080, 11_002_330, { code: "8247" }),
        acct("8725", "Certification Expenses", 5_021, 4_450, {
          code: "8725",
          regionBreakdown: [
            { region: "India", amount: 2021 },
            { region: "UK", amount: 1000 },
            { region: "US", amount: 1000 },
            { region: "Cyprus", amount: 500 },
            { region: "Dubai", amount: 500 },
          ],
        }),
        acct("8739", "Gratuity", 9_834_200, 9_100_415, { code: "8739" }),
        acct("8757", "Insurance - Employees Group Accidental", 3_120_440, 2_980_100, { code: "8757" }),
        acct("8758", "Interest", 1_254_980, 1_310_220, { code: "8758" }),
      ],
    }),
    acct("misc-sales", "Misc. Sales", 37_437_665, 35_118_240),
    acct("software", "Software", 134_286_589, 120_440_833, {
      hasDetails: true,
      children: [
        acct("sw-licences", "Licences", 98_441_200, 88_210_450, { code: "9101" }),
        acct("sw-cloud", "Cloud & Hosting", 35_845_389, 32_230_383, { code: "9102" }),
      ],
    }),
    acct("fees", "Fees Expense", 6_385_440, 6_020_118),
    acct("insurance", "Insurance Expense", 4_120_338, 4_455_020),
    acct("interest", "Interest Expense", 2_854_406, 2_790_360),
    acct("other", "Other Expense", 1_207_868, 1_344_205),
  ];
}

/** Simulated async sub-account endpoint (honours AbortSignal). */
export function fetchSubAccounts(
  row: ExpenseAccount,
  options: { signal?: AbortSignal; failRate?: number; delayMs?: number } = {}
): Promise<ExpenseAccount[]> {
  const { signal, failRate = 0, delayMs = 700 } = options;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (Math.random() < failRate) {
        reject(new Error(`Could not fetch sub-accounts of ${row.name} (simulated)`));
        return;
      }
      resolve(row.children ?? []);
    }, delayMs);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/* ================================================================== */
/* v0.2.1 — messy numerics fixture (NaN / null sorting demo)           */
/* ================================================================== */

export interface MessyRow {
  id: string;
  account: string;
  amount: number | null;
}

export function makeMessyData(): MessyRow[] {
  return [
    { id: "m1", account: "Travel", amount: 5_400 },
    { id: "m2", account: "Catering (feed failed)", amount: Number.NaN },
    { id: "m3", account: "Office supplies", amount: 1_150 },
    { id: "m4", account: "Not yet posted", amount: null },
    { id: "m5", account: "Conferences", amount: 3_275 },
    { id: "m6", account: "Stationery (feed failed)", amount: Number.NaN },
    { id: "m7", account: "Reuitment", amount: 8_960 },
  ];
}
