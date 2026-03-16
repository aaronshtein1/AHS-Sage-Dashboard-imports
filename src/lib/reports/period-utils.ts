import type { PeriodConfig, PeriodType } from '@/types';

/** Parse a period string (YYYY-MM) into year and month */
export function parsePeriod(period: string): { year: number; month: number } {
  const [yearStr, monthStr] = period.split('-');
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
  };
}

/** Format year and month into a period string (YYYY-MM) */
export function formatPeriod(year: number, month: number): string {
  return `${year}-${month.toString().padStart(2, '0')}`;
}

/** Get the current period (YYYY-MM) */
export function getCurrentPeriod(): string {
  const now = new Date();
  return formatPeriod(now.getFullYear(), now.getMonth() + 1);
}

/** Get today's date as YYYY-MM-DD */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/** Get the first day of a period */
export function getPeriodStartDate(period: string): string {
  const { year, month } = parsePeriod(period);
  return `${year}-${month.toString().padStart(2, '0')}-01`;
}

/** Get the last day of a period */
export function getPeriodEndDate(period: string): string {
  const { year, month } = parsePeriod(period);
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
}

/** Get the previous period */
export function getPreviousPeriod(period: string, steps: number = 1): string {
  const { year, month } = parsePeriod(period);
  let newMonth = month - steps;
  let newYear = year;

  while (newMonth < 1) {
    newMonth += 12;
    newYear--;
  }

  return formatPeriod(newYear, newMonth);
}

/** Get the same period in the prior year */
export function getPriorYearPeriod(period: string): string {
  const { year, month } = parsePeriod(period);
  return formatPeriod(year - 1, month);
}

/** Get a human-readable label for a period */
export function getPeriodLabel(period: string): string {
  const { year, month } = parsePeriod(period);
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${monthNames[month - 1]} ${year}`;
}

/** Get the fiscal year start period based on fiscal year start month */
export function getFiscalYearStart(period: string, fiscalYearStartMonth: number = 1): string {
  const { year, month } = parsePeriod(period);

  if (month >= fiscalYearStartMonth) {
    return formatPeriod(year, fiscalYearStartMonth);
  } else {
    return formatPeriod(year - 1, fiscalYearStartMonth);
  }
}

/** Get the quarter number (1-4) for a given month */
export function getQuarter(month: number, fiscalYearStartMonth: number = 1): number {
  // Adjust month to fiscal year
  const adjustedMonth = ((month - fiscalYearStartMonth + 12) % 12) + 1;
  return Math.ceil(adjustedMonth / 3);
}

/** Get the start period of the current quarter */
export function getQuarterStart(period: string, fiscalYearStartMonth: number = 1): string {
  const { year, month } = parsePeriod(period);
  const quarter = getQuarter(month, fiscalYearStartMonth);

  // Calculate the first month of the quarter
  const quarterStartOffset = (quarter - 1) * 3;
  const quarterStartMonth = ((fiscalYearStartMonth - 1 + quarterStartOffset) % 12) + 1;
  let quarterStartYear = year;

  // Adjust year if necessary
  if (quarterStartMonth > month) {
    quarterStartYear--;
  }

  return formatPeriod(quarterStartYear, quarterStartMonth);
}

/** Calculate the date range for a period configuration */
export interface DateRange {
  startDate: string;
  endDate: string;
  periodLabel: string;
}

export function calculateDateRange(config: PeriodConfig): DateRange {
  const fiscalYearStartMonth = config.fiscalYearStartMonth || 1;

  switch (config.type) {
    case 'single': {
      const period = config.startPeriod || getCurrentPeriod();
      return {
        startDate: getPeriodStartDate(period),
        endDate: getPeriodEndDate(period),
        periodLabel: getPeriodLabel(period),
      };
    }

    case 'range': {
      const startPeriod = config.startPeriod || getCurrentPeriod();
      const endPeriod = config.endPeriod || getCurrentPeriod();
      return {
        startDate: getPeriodStartDate(startPeriod),
        endDate: getPeriodEndDate(endPeriod),
        periodLabel: `${getPeriodLabel(startPeriod)} - ${getPeriodLabel(endPeriod)}`,
      };
    }

    case 'ytd': {
      const currentPeriod = config.startPeriod || getCurrentPeriod();
      const fiscalYearStart = getFiscalYearStart(currentPeriod, fiscalYearStartMonth);
      const { year } = parsePeriod(currentPeriod);
      return {
        startDate: getPeriodStartDate(fiscalYearStart),
        endDate: getPeriodEndDate(currentPeriod),
        periodLabel: `YTD ${year}`,
      };
    }

    case 'mtd': {
      const currentPeriod = config.startPeriod || getCurrentPeriod();
      const today = config.asOfDate || getTodayDate();
      return {
        startDate: getPeriodStartDate(currentPeriod),
        endDate: today,
        periodLabel: `MTD ${getPeriodLabel(currentPeriod)}`,
      };
    }

    case 'qtd': {
      const currentPeriod = config.startPeriod || getCurrentPeriod();
      const quarterStart = getQuarterStart(currentPeriod, fiscalYearStartMonth);
      const { year, month } = parsePeriod(currentPeriod);
      const quarter = getQuarter(month, fiscalYearStartMonth);
      return {
        startDate: getPeriodStartDate(quarterStart),
        endDate: getPeriodEndDate(currentPeriod),
        periodLabel: `Q${quarter} ${year}`,
      };
    }

    case 'rolling-12': {
      const endPeriod = config.startPeriod || getCurrentPeriod();
      const startPeriod = getPreviousPeriod(endPeriod, 11);
      return {
        startDate: getPeriodStartDate(startPeriod),
        endDate: getPeriodEndDate(endPeriod),
        periodLabel: `Rolling 12 Months ending ${getPeriodLabel(endPeriod)}`,
      };
    }

    default:
      throw new Error(`Unknown period type: ${config.type}`);
  }
}

/** Get list of periods for selection dropdown */
export function getPeriodOptions(count: number = 24): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  let period = getCurrentPeriod();

  for (let i = 0; i < count; i++) {
    options.push({
      value: period,
      label: getPeriodLabel(period),
    });
    period = getPreviousPeriod(period);
  }

  return options;
}

/** Period type labels for display */
export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  single: 'Single Period',
  range: 'Date Range',
  ytd: 'Year-to-Date',
  mtd: 'Month-to-Date',
  qtd: 'Quarter-to-Date',
  'rolling-12': 'Rolling 12 Months',
};

/** Get comparison period based on type */
export function getComparisonRange(
  config: PeriodConfig,
  comparisonType: 'prior-period' | 'prior-year'
): DateRange {
  const mainRange = calculateDateRange(config);

  if (comparisonType === 'prior-year') {
    // Prior year same period
    const { year: startYear, month: startMonth } = parsePeriod(
      mainRange.startDate.substring(0, 7)
    );
    const { year: endYear, month: endMonth } = parsePeriod(
      mainRange.endDate.substring(0, 7)
    );

    return {
      startDate: getPeriodStartDate(formatPeriod(startYear - 1, startMonth)),
      endDate: getPeriodEndDate(formatPeriod(endYear - 1, endMonth)),
      periodLabel: `Prior Year`,
    };
  } else {
    // Prior period (same length, just before)
    const startParts = mainRange.startDate.split('-').map(Number);
    const endParts = mainRange.endDate.split('-').map(Number);

    const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const priorEndDate = new Date(startDate);
    priorEndDate.setDate(priorEndDate.getDate() - 1);
    const priorStartDate = new Date(priorEndDate);
    priorStartDate.setDate(priorStartDate.getDate() - daysDiff + 1);

    return {
      startDate: priorStartDate.toISOString().split('T')[0],
      endDate: priorEndDate.toISOString().split('T')[0],
      periodLabel: 'Prior Period',
    };
  }
}
