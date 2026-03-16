import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  value: number,
  options?: boolean | { compact?: boolean; showSign?: boolean }
): string {
  // Handle legacy boolean parameter for backward compatibility
  const compact = typeof options === 'boolean' ? options : options?.compact ?? false;
  const showSign = typeof options === 'object' ? options?.showSign ?? false : false;

  let formatted: string;
  if (compact && Math.abs(value) >= 1000000) {
    formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  } else {
    formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (showSign && value > 0) {
    formatted = '+' + formatted;
  }

  return formatted;
}

export function formatPercent(
  value: number,
  options?: number | { decimals?: number; showSign?: boolean }
): string {
  // Handle legacy number parameter for backward compatibility
  const decimals = typeof options === 'number' ? options : options?.decimals ?? 1;
  const showSign = typeof options === 'object' ? options?.showSign ?? true : true;

  const sign = showSign && value > 0 ? '+' : (value < 0 ? '' : '');
  return `${sign}${value.toFixed(decimals)}%`;
}

export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getPreviousPeriod(period: string, count: number = 1): string {
  let [year, month] = period.split('-').map(Number);
  for (let i = 0; i < count; i++) {
    if (month === 1) {
      year -= 1;
      month = 12;
    } else {
      month -= 1;
    }
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getPeriodLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function getPriorYearPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return `${year - 1}-${String(month).padStart(2, '0')}`;
}
