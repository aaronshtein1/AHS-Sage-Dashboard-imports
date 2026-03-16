import type { CustomColumn, CustomColumnType } from '@/types';

/** Column definition template */
interface ColumnDefinition {
  type: CustomColumnType;
  label: string;
  dataType: 'text' | 'number' | 'currency' | 'percent';
  align: 'left' | 'center' | 'right';
  width?: number;
  category: 'account-info' | 'balances' | 'activity' | 'period' | 'comparison' | 'budget';
  description: string;
}

/** All available column definitions */
export const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  // Account Information
  {
    type: 'account-code',
    label: 'Account Code',
    dataType: 'text',
    align: 'left',
    width: 100,
    category: 'account-info',
    description: 'Account number/code',
  },
  {
    type: 'account-title',
    label: 'Account Title',
    dataType: 'text',
    align: 'left',
    width: 200,
    category: 'account-info',
    description: 'Account name/description',
  },
  {
    type: 'account-type',
    label: 'Type',
    dataType: 'text',
    align: 'left',
    width: 100,
    category: 'account-info',
    description: 'Account type (Asset, Liability, etc.)',
  },
  {
    type: 'category',
    label: 'Category',
    dataType: 'text',
    align: 'left',
    width: 120,
    category: 'account-info',
    description: 'Account category',
  },

  // Balance Columns
  {
    type: 'opening-balance',
    label: 'Opening Balance',
    dataType: 'currency',
    align: 'right',
    width: 130,
    category: 'balances',
    description: 'Balance at start of period',
  },
  {
    type: 'ending-balance',
    label: 'Ending Balance',
    dataType: 'currency',
    align: 'right',
    width: 130,
    category: 'balances',
    description: 'Balance at end of period',
  },

  // Activity Columns
  {
    type: 'debit',
    label: 'Debits',
    dataType: 'currency',
    align: 'right',
    width: 120,
    category: 'activity',
    description: 'Total debit activity',
  },
  {
    type: 'credit',
    label: 'Credits',
    dataType: 'currency',
    align: 'right',
    width: 120,
    category: 'activity',
    description: 'Total credit activity',
  },
  {
    type: 'net-change',
    label: 'Net Change',
    dataType: 'currency',
    align: 'right',
    width: 120,
    category: 'activity',
    description: 'Net change for period',
  },

  // Period Amount Columns
  {
    type: 'period-amount',
    label: 'Period Amount',
    dataType: 'currency',
    align: 'right',
    width: 130,
    category: 'period',
    description: 'Amount for selected period',
  },
  {
    type: 'ytd-amount',
    label: 'YTD Amount',
    dataType: 'currency',
    align: 'right',
    width: 130,
    category: 'period',
    description: 'Year-to-date amount',
  },
  {
    type: 'mtd-amount',
    label: 'MTD Amount',
    dataType: 'currency',
    align: 'right',
    width: 130,
    category: 'period',
    description: 'Month-to-date amount',
  },
  {
    type: 'qtd-amount',
    label: 'QTD Amount',
    dataType: 'currency',
    align: 'right',
    width: 130,
    category: 'period',
    description: 'Quarter-to-date amount',
  },

  // Prior Period Comparison
  {
    type: 'prior-period',
    label: 'Prior Period',
    dataType: 'currency',
    align: 'right',
    width: 130,
    category: 'comparison',
    description: 'Prior period amount',
  },
  {
    type: 'prior-period-variance',
    label: 'PP Variance $',
    dataType: 'currency',
    align: 'right',
    width: 120,
    category: 'comparison',
    description: 'Variance from prior period',
  },
  {
    type: 'prior-period-variance-pct',
    label: 'PP Variance %',
    dataType: 'percent',
    align: 'right',
    width: 100,
    category: 'comparison',
    description: 'Variance % from prior period',
  },

  // Prior Year Comparison
  {
    type: 'prior-year',
    label: 'Prior Year',
    dataType: 'currency',
    align: 'right',
    width: 130,
    category: 'comparison',
    description: 'Prior year same period',
  },
  {
    type: 'prior-year-variance',
    label: 'PY Variance $',
    dataType: 'currency',
    align: 'right',
    width: 120,
    category: 'comparison',
    description: 'Variance from prior year',
  },
  {
    type: 'prior-year-variance-pct',
    label: 'PY Variance %',
    dataType: 'percent',
    align: 'right',
    width: 100,
    category: 'comparison',
    description: 'Variance % from prior year',
  },

  // Budget Columns
  {
    type: 'budget',
    label: 'Budget',
    dataType: 'currency',
    align: 'right',
    width: 130,
    category: 'budget',
    description: 'Budgeted amount',
  },
  {
    type: 'budget-variance',
    label: 'Budget Var $',
    dataType: 'currency',
    align: 'right',
    width: 120,
    category: 'budget',
    description: 'Variance from budget',
  },
  {
    type: 'budget-variance-pct',
    label: 'Budget Var %',
    dataType: 'percent',
    align: 'right',
    width: 100,
    category: 'budget',
    description: 'Variance % from budget',
  },
];

/** Get column definitions grouped by category */
export function getColumnsByCategory(): Record<string, ColumnDefinition[]> {
  return COLUMN_DEFINITIONS.reduce(
    (acc, col) => {
      if (!acc[col.category]) {
        acc[col.category] = [];
      }
      acc[col.category].push(col);
      return acc;
    },
    {} as Record<string, ColumnDefinition[]>
  );
}

/** Category display names */
export const CATEGORY_LABELS: Record<string, string> = {
  'account-info': 'Account Information',
  balances: 'Balances',
  activity: 'Activity',
  period: 'Period Amounts',
  comparison: 'Comparisons',
  budget: 'Budget',
};

/** Get a column definition by type */
export function getColumnDefinition(type: CustomColumnType): ColumnDefinition | undefined {
  return COLUMN_DEFINITIONS.find((col) => col.type === type);
}

/** Create a CustomColumn from a definition */
export function createColumn(type: CustomColumnType, order: number): CustomColumn {
  const def = getColumnDefinition(type);
  if (!def) {
    throw new Error(`Unknown column type: ${type}`);
  }
  return {
    id: `${type}-${Date.now()}`,
    type,
    label: def.label,
    dataType: def.dataType,
    align: def.align,
    visible: true,
    order,
    width: def.width,
  };
}

/** Default columns for a new report */
export function getDefaultColumns(): CustomColumn[] {
  const defaultTypes: CustomColumnType[] = [
    'account-code',
    'account-title',
    'ending-balance',
  ];
  return defaultTypes.map((type, index) => createColumn(type, index));
}

/** Get a preset column configuration */
export type ColumnPreset = 'trial-balance' | 'activity' | 'ytd-comparison' | 'budget-vs-actual';

export function getPresetColumns(preset: ColumnPreset): CustomColumn[] {
  const presets: Record<ColumnPreset, CustomColumnType[]> = {
    'trial-balance': ['account-code', 'account-title', 'debit', 'credit', 'ending-balance'],
    activity: [
      'account-code',
      'account-title',
      'opening-balance',
      'debit',
      'credit',
      'net-change',
      'ending-balance',
    ],
    'ytd-comparison': [
      'account-code',
      'account-title',
      'ytd-amount',
      'prior-year',
      'prior-year-variance',
      'prior-year-variance-pct',
    ],
    'budget-vs-actual': [
      'account-code',
      'account-title',
      'period-amount',
      'budget',
      'budget-variance',
      'budget-variance-pct',
    ],
  };

  return presets[preset].map((type, index) => createColumn(type, index));
}
