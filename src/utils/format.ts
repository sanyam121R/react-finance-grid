/* Finance-friendly formatter helpers (zero dependencies, Intl based). */

export interface CurrencyOptions {
  currency?: string;
  locale?: string;
  /** Minimum fraction digits (default 0). */
  minimumFractionDigits?: number;
  /** Maximum fraction digits (default 0). */
  maximumFractionDigits?: number;
  /** Render negatives as (1,234) instead of -1,234. */
  accounting?: boolean;
  /** Compact notation: 1.2M. */
  compact?: boolean;
}

/** `formatCurrency(1234.5)` -> "$1,235" */
export function formatCurrency(
  value: number | null | undefined,
  options: CurrencyOptions = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const {
    currency = "USD",
    locale,
    accounting = false,
    compact = false,
  } = options;
  // compact notation reads better with one fraction digit ("$1.3M")
  const minimumFractionDigits = options.minimumFractionDigits ?? 0;
  const maximumFractionDigits = options.maximumFractionDigits ?? (compact ? 1 : 0);
  const abs = accounting ? Math.abs(value) : value;
  const text = abs.toLocaleString(locale, {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
    notation: compact ? "compact" : "standard",
  });
  return accounting && value < 0 ? `(${text})` : text;
}

/** Reusable formatter bound to a currency/locale. */
export function createCurrencyFormatter(options: CurrencyOptions = {}) {
  return (value: number | null | undefined): string =>
    formatCurrency(value, options);
}

/** `formatPercent(0.1234)` -> "12.3%"; pass `{ alreadyScaled: true }` for 12.34. */
export function formatPercent(
  value: number | null | undefined,
  options: {
    locale?: string;
    maximumFractionDigits?: number;
    alreadyScaled?: boolean;
  } = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const { locale, maximumFractionDigits = 1, alreadyScaled = false } = options;
  return (alreadyScaled ? value / 100 : value).toLocaleString(locale, {
    style: "percent",
    maximumFractionDigits,
  });
}

/** `formatNumber(1234567.89)` -> "1,234,567.89" */
export function formatNumber(
  value: number | null | undefined,
  options: { locale?: string; maximumFractionDigits?: number; compact?: boolean } = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const { locale, compact = false } = options;
  const maximumFractionDigits =
    options.maximumFractionDigits ?? (compact ? 1 : 2);
  return value.toLocaleString(locale, {
    maximumFractionDigits,
    notation: compact ? "compact" : "standard",
  });
}

/** Signed variance string, e.g. "+1,200" / "-900". */
export function formatVariance(
  value: number | null | undefined,
  options: CurrencyOptions & { currencyStyle?: boolean } = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const body = options.currencyStyle
    ? formatCurrency(Math.abs(value), options)
    : formatNumber(Math.abs(value), { locale: options.locale });
  if (value === 0) return body;
  return `${value > 0 ? "+" : "-"}${body}`;
}