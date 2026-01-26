import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  options: { compact?: boolean; showSign?: boolean } = {}
): string {
  const { compact = false, showSign = false } = options;

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  });

  const formatted = formatter.format(Math.abs(amount));

  if (showSign && amount !== 0) {
    return amount > 0 ? `+${formatted}` : `-${formatted}`;
  }

  return amount < 0 ? `-${formatted}` : formatted;
}

export function formatPercent(
  value: number,
  options: { decimals?: number; showSign?: boolean } = {}
): string {
  const { decimals = 1, showSign = false } = options;

  const formatted = `${Math.abs(value).toFixed(decimals)}%`;

  if (showSign && value !== 0) {
    return value > 0 ? `+${formatted}` : `-${formatted}`;
  }

  return value < 0 ? `-${formatted}` : formatted;
}

export function formatNumber(
  value: number,
  options: { decimals?: number; compact?: boolean } = {}
): string {
  const { decimals = 0, compact = false } = options;

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

export function calculateVariance(
  actual: number,
  budget: number
): { amount: number; percent: number } {
  const amount = actual - budget;
  const percent = budget !== 0 ? (amount / Math.abs(budget)) * 100 : 0;
  return { amount, percent };
}

export function calculateGrowth(
  current: number,
  previous: number
): { amount: number; percent: number } {
  const amount = current - previous;
  const percent = previous !== 0 ? (amount / Math.abs(previous)) * 100 : 0;
  return { amount, percent };
}

export function getPeriodLabel(period: string): string {
  const [year, month] = period.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getPreviousPeriod(period: string, months: number = 1): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 1 - months);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getPeriodsInRange(start: string, end: string): string[] {
  const periods: string[] = [];
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);

  let current = new Date(startYear, startMonth - 1);
  const endDate = new Date(endYear, endMonth - 1);

  while (current <= endDate) {
    periods.push(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`
    );
    current.setMonth(current.getMonth() + 1);
  }

  return periods;
}

export function getFiscalYear(period: string, startMonth: number = 1): number {
  const [year, month] = period.split("-").map(Number);
  return month >= startMonth ? year : year - 1;
}

export function getYTDPeriods(period: string, fiscalStartMonth: number = 1): string[] {
  const [year, month] = period.split("-").map(Number);
  const fiscalYear = getFiscalYear(period, fiscalStartMonth);

  const startPeriod = `${fiscalYear}-${String(fiscalStartMonth).padStart(2, "0")}`;
  return getPeriodsInRange(startPeriod, period);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}
