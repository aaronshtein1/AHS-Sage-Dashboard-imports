'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  FRWReportDefinition,
  FRWAccountGroup,
  FRWColumn,
  FRWColumnType,
  FRWGeneratedReport,
  FRWReportRow,
  DimensionType,
  DimensionValue,
} from '@/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Info,
  Rows3,
  Columns3,
  Calculator,
  Filter,
  Paintbrush,
  FileText,
  Shield,
  ArrowRight,
  Play,
  Save,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Eye,
  X,
  MoveUp,
  MoveDown,
  Settings2,
  Calendar,
} from 'lucide-react';

// Column type labels
const columnTypeLabels: Record<FRWColumnType, string> = {
  'account-name': 'Account name',
  'account-number': 'Account number',
  'account-number-name': 'Account number and name',
  'account-attribute': 'Account attribute',
  'actual': 'Actual',
  'budget': 'Budget',
  'computation-actual': 'Computation on actual',
  'computation-budget': 'Computation on budget',
  'summary-columns': 'Summary on columns',
  'period-variance': 'Period variance',
  'period-variance-normalized': 'Period variance (normalized)',
  'period-difference': 'Period difference',
  'period-difference-normalized': 'Period difference (normalized)',
  'actual-minus-budget': 'Actual minus budget',
  'actual-minus-budget-normalized': 'Actual minus budget (normalized)',
  'budget-minus-actual': 'Budget minus actual',
  'budget-minus-actual-normalized': 'Budget minus actual (normalized)',
  'budget-variance': 'Budget variance',
  'budget-variance-normalized': 'Budget variance (normalized)',
  'budget-ratio': 'Budget ratio',
  'remaining-budget': 'Remaining budget',
  'forecast-prorated': 'Forecast: Prorated',
  'forecast-full-period': 'Forecast: Full Period',
  'percent-actual': 'Percent on actual',
  'percent-budget': 'Percent on budget',
  'spacer': 'Spacer / Vertical divider',
};

// Default account groups for Balance Sheet
const defaultBalanceSheetGroups: FRWAccountGroup[] = [
  {
    id: 'assets',
    name: 'Assets',
    type: 'section',
    accountType: 'ASSET',
    detailLevel: 'summary',
    basisForAmounts: 'cumulative',
    alwaysDisplay: true,
    printTotal: true,
    expanded: true,
    children: [
      {
        id: 'current-assets',
        name: 'Current Assets',
        type: 'group',
        accountType: 'ASSET',
        accountCodeRange: { start: '1000', end: '1499' },
        detailLevel: 'summary',
        basisForAmounts: 'cumulative',
        alwaysDisplay: true,
        printTotal: true,
        expanded: false,
        children: [
          { id: 'cash', name: 'Cash and Cash Equivalents', type: 'group', accountCodeRange: { start: '1000', end: '1099' }, detailLevel: 'summary', basisForAmounts: 'cumulative', alwaysDisplay: true, printTotal: true },
          { id: 'short-term-investments', name: 'Short Term Investments', type: 'group', accountCodeRange: { start: '1100', end: '1199' }, detailLevel: 'summary', basisForAmounts: 'cumulative', alwaysDisplay: true, printTotal: true },
          { id: 'accounts-receivable', name: 'Accounts Receivable, Net', type: 'group', accountCodeRange: { start: '1200', end: '1299' }, detailLevel: 'summary', basisForAmounts: 'cumulative', alwaysDisplay: true, printTotal: true },
          { id: 'prepaid', name: 'Prepaid Expenses', type: 'group', accountCodeRange: { start: '1300', end: '1399' }, detailLevel: 'summary', basisForAmounts: 'cumulative', alwaysDisplay: true, printTotal: true },
          { id: 'other-current', name: 'Other Current Assets', type: 'group', accountCodeRange: { start: '1400', end: '1499' }, detailLevel: 'summary', basisForAmounts: 'cumulative', alwaysDisplay: true, printTotal: true },
        ],
      },
      {
        id: 'fixed-assets',
        name: 'Fixed Assets, Net',
        type: 'group',
        accountType: 'ASSET',
        accountCodeRange: { start: '1500', end: '1699' },
        detailLevel: 'summary',
        basisForAmounts: 'cumulative',
        alwaysDisplay: true,
        printTotal: true,
      },
      {
        id: 'other-assets',
        name: 'Other Assets',
        type: 'group',
        accountType: 'ASSET',
        accountCodeRange: { start: '1700', end: '1999' },
        detailLevel: 'summary',
        basisForAmounts: 'cumulative',
        alwaysDisplay: true,
        printTotal: true,
      },
    ],
  },
  {
    id: 'liabilities-equity',
    name: 'Liabilities and Equity',
    type: 'section',
    detailLevel: 'summary',
    basisForAmounts: 'cumulative',
    alwaysDisplay: true,
    printTotal: true,
    expanded: true,
    children: [
      {
        id: 'liabilities',
        name: 'Liabilities',
        type: 'section',
        accountType: 'LIABILITY',
        detailLevel: 'summary',
        basisForAmounts: 'cumulative',
        alwaysDisplay: true,
        printTotal: true,
        expanded: false,
        children: [
          { id: 'current-liabilities', name: 'Current Liabilities', type: 'group', accountCodeRange: { start: '2000', end: '2499' }, detailLevel: 'summary', basisForAmounts: 'cumulative', alwaysDisplay: true, printTotal: true },
          { id: 'long-term-liabilities', name: 'Long Term Liabilities', type: 'group', accountCodeRange: { start: '2500', end: '2999' }, detailLevel: 'summary', basisForAmounts: 'cumulative', alwaysDisplay: true, printTotal: true },
        ],
      },
      {
        id: 'equity',
        name: 'Stockholders Equity',
        type: 'group',
        accountType: 'EQUITY',
        accountCodeRange: { start: '3000', end: '3999' },
        detailLevel: 'summary',
        basisForAmounts: 'cumulative',
        alwaysDisplay: true,
        printTotal: true,
      },
    ],
  },
];

// Income Statement groups
const defaultIncomeStatementGroups: FRWAccountGroup[] = [
  {
    id: 'revenue',
    name: 'Revenue',
    type: 'section',
    accountType: 'REVENUE',
    accountCodeRange: { start: '4000', end: '4999' },
    detailLevel: 'summary',
    basisForAmounts: 'period',
    alwaysDisplay: true,
    printTotal: true,
    expanded: true,
  },
  {
    id: 'expenses',
    name: 'Expenses',
    type: 'section',
    accountType: 'EXPENSE',
    detailLevel: 'summary',
    basisForAmounts: 'period',
    alwaysDisplay: true,
    printTotal: true,
    expanded: true,
    children: [
      { id: 'cogs', name: 'Cost of Goods Sold', type: 'group', accountCodeRange: { start: '5000', end: '5099' }, detailLevel: 'summary', basisForAmounts: 'period', alwaysDisplay: true, printTotal: true },
      { id: 'payroll', name: 'Payroll & Benefits', type: 'group', accountCodeRange: { start: '5100', end: '5499' }, detailLevel: 'summary', basisForAmounts: 'period', alwaysDisplay: true, printTotal: true },
      { id: 'operating', name: 'Operating Expenses', type: 'group', accountCodeRange: { start: '6000', end: '6999' }, detailLevel: 'summary', basisForAmounts: 'period', alwaysDisplay: true, printTotal: true },
    ],
  },
  {
    id: 'net-income',
    name: 'Net Income',
    type: 'computed',
    detailLevel: 'summary',
    basisForAmounts: 'period',
    alwaysDisplay: true,
    printTotal: true,
  },
];

// Default columns
const defaultColumns: FRWColumn[] = [
  {
    id: 'col-1',
    type: 'account-name',
    label: 'Account',
    reportingPeriod: 'current-year',
    showAs: 'number',
    hidden: false,
    order: 0,
    width: 300,
  },
  {
    id: 'col-2',
    type: 'actual',
    label: 'Current Year',
    header1: 'Period name',
    header2: 'Period date',
    reportingPeriod: 'current-year',
    expandBy: 'none',
    showAs: 'currency',
    precision: 2,
    hidden: false,
    order: 1,
    width: 150,
  },
];

function createDefaultDefinition(reportType: 'balance-sheet' | 'income-statement' | 'custom' = 'balance-sheet'): FRWReportDefinition {
  const groups = reportType === 'income-statement' ? defaultIncomeStatementGroups : defaultBalanceSheetGroups;
  const name = reportType === 'income-statement' ? 'Income Statement' : 'Balance Sheet - Condensed';

  return {
    id: '',
    name,
    description: '',
    reportType,
    rowStructure: groups,
    defaultDetailLevel: 'summary',
    columns: [...defaultColumns],
    computations: [],
    filters: {
      excludeZeroBalances: true,
      excludeInactiveAccounts: true,
    },
    format: {
      showAccountNumbers: false,
      showHierarchy: true,
      indentAmount: 20,
      negativeFormat: 'parentheses',
      thousandsSeparator: true,
      decimalPlaces: 2,
      pageOrientation: 'portrait',
      paperSize: 'letter',
    },
    isSystemReport: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

type TabId = 'report-info' | 'rows' | 'columns' | 'computations' | 'filters' | 'format' | 'preview';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'report-info', label: 'Report info', icon: <Info className="h-4 w-4" /> },
  { id: 'rows', label: 'Rows', icon: <Rows3 className="h-4 w-4" /> },
  { id: 'columns', label: 'Columns', icon: <Columns3 className="h-4 w-4" /> },
  { id: 'computations', label: 'Computations', icon: <Calculator className="h-4 w-4" /> },
  { id: 'filters', label: 'Filters', icon: <Filter className="h-4 w-4" /> },
  { id: 'format', label: 'Format', icon: <Paintbrush className="h-4 w-4" /> },
  { id: 'preview', label: 'Preview', icon: <Eye className="h-4 w-4" /> },
];

// Format currency
const formatCurrency = (value: number, format: FRWReportDefinition['format']): string => {
  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: format.decimalPlaces,
    maximumFractionDigits: format.decimalPlaces,
  }).format(absValue);

  if (value < 0) {
    if (format.negativeFormat === 'parentheses') {
      return `(${formatted})`;
    }
    return `-${formatted}`;
  }
  return formatted;
};

// Account group row component for Rows tab
function AccountGroupRow({
  group,
  level,
  onToggle,
  onUpdate,
  onDelete,
}: {
  group: FRWAccountGroup;
  level: number;
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FRWAccountGroup>) => void;
  onDelete: (id: string) => void;
}) {
  const hasChildren = group.children && group.children.length > 0;
  const isExpanded = group.expanded !== false;

  return (
    <>
      <tr className="border-b border-zinc-100 hover:bg-zinc-50 group">
        <td className="py-2 px-3" style={{ paddingLeft: `${level * 20 + 12}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button
                onClick={() => onToggle(group.id)}
                className="p-0.5 hover:bg-zinc-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <span className={`text-sm ${group.type === 'section' ? 'font-semibold' : ''}`}>
              {hasChildren ? `[${isExpanded ? '-' : '+'}] ` : ''}
              {group.name}
            </span>
          </div>
        </td>
        <td className="py-2 px-3">
          <Select
            value={group.detailLevel}
            onValueChange={(value: 'summary' | 'detail') => onUpdate(group.id, { detailLevel: value })}
          >
            <SelectTrigger className="h-7 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Summary</SelectItem>
              <SelectItem value="detail">Detail</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="py-2 px-3">
          <Select
            value={group.basisForAmounts}
            onValueChange={(value: 'period' | 'cumulative' | 'percent') => onUpdate(group.id, { basisForAmounts: value })}
          >
            <SelectTrigger className="h-7 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="period">Period</SelectItem>
              <SelectItem value="cumulative">Cumulative</SelectItem>
              <SelectItem value="percent">Percent</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="py-2 px-3 text-center">
          <Checkbox
            checked={group.alwaysDisplay}
            onCheckedChange={(checked) => onUpdate(group.id, { alwaysDisplay: !!checked })}
          />
        </td>
        <td className="py-2 px-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
            onClick={() => onDelete(group.id)}
          >
            <Trash2 className="h-3 w-3 text-zinc-400" />
          </Button>
        </td>
      </tr>
      {hasChildren && isExpanded && group.children?.map((child) => (
        <AccountGroupRow
          key={child.id}
          group={child}
          level={level + 1}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

export default function FinancialReportWriterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id');

  const [definition, setDefinition] = useState<FRWReportDefinition>(createDefaultDefinition());
  const [activeTab, setActiveTab] = useState<TabId>('columns');
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showAddColumnDialog, setShowAddColumnDialog] = useState(false);
  const [showAddRowDialog, setShowAddRowDialog] = useState(false);
  const [showRunReportDialog, setShowRunReportDialog] = useState(false);
  const [editingColumn, setEditingColumn] = useState<FRWColumn | null>(null);
  const [previewData, setPreviewData] = useState<FRWGeneratedReport | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Dimensions state
  const [dimensionTypes, setDimensionTypes] = useState<DimensionType[]>([]);
  const [dimensionValues, setDimensionValues] = useState<DimensionValue[]>([]);

  // Report run parameters
  const [reportAsOfDate, setReportAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportPeriodType, setReportPeriodType] = useState<'month' | 'quarter' | 'year' | 'ytd' | 'custom'>('month');
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');

  // New column form state
  const [newColumn, setNewColumn] = useState<Partial<FRWColumn>>({
    type: 'actual',
    label: 'New Column',
    reportingPeriod: 'current-year',
    showAs: 'currency',
    expandBy: 'none',
    hidden: false,
  });

  // Load dimensions on mount
  useEffect(() => {
    const loadDimensions = async () => {
      try {
        const [types, values] = await Promise.all([
          api.getDimensionTypes(),
          api.getDimensionValues(),
        ]);
        setDimensionTypes(types);
        setDimensionValues(values);
      } catch (error) {
        console.error('Failed to load dimensions:', error);
      }
    };
    loadDimensions();
  }, []);

  // Load saved reports from localStorage
  useEffect(() => {
    if (reportId) {
      const saved = localStorage.getItem('frw_reports');
      if (saved) {
        const reports: FRWReportDefinition[] = JSON.parse(saved);
        const found = reports.find(r => r.id === reportId);
        if (found) {
          setDefinition(found);
        }
      }
    }
  }, [reportId]);

  // Toggle group expansion
  const toggleGroup = (groupId: string) => {
    const toggleInGroups = (groups: FRWAccountGroup[]): FRWAccountGroup[] => {
      return groups.map((g) => {
        if (g.id === groupId) {
          return { ...g, expanded: g.expanded === false };
        }
        if (g.children) {
          return { ...g, children: toggleInGroups(g.children) };
        }
        return g;
      });
    };

    setDefinition((prev) => ({
      ...prev,
      rowStructure: toggleInGroups(prev.rowStructure),
    }));
  };

  // Update a group
  const updateGroup = (groupId: string, updates: Partial<FRWAccountGroup>) => {
    const updateInGroups = (groups: FRWAccountGroup[]): FRWAccountGroup[] => {
      return groups.map((g) => {
        if (g.id === groupId) {
          return { ...g, ...updates };
        }
        if (g.children) {
          return { ...g, children: updateInGroups(g.children) };
        }
        return g;
      });
    };

    setDefinition((prev) => ({
      ...prev,
      rowStructure: updateInGroups(prev.rowStructure),
    }));
    setIsDirty(true);
  };

  // Delete a group
  const deleteGroup = (groupId: string) => {
    const deleteFromGroups = (groups: FRWAccountGroup[]): FRWAccountGroup[] => {
      return groups
        .filter(g => g.id !== groupId)
        .map(g => ({
          ...g,
          children: g.children ? deleteFromGroups(g.children) : undefined,
        }));
    };

    setDefinition((prev) => ({
      ...prev,
      rowStructure: deleteFromGroups(prev.rowStructure),
    }));
    setIsDirty(true);
  };

  // Add a new column
  const addColumn = () => {
    const newCol: FRWColumn = {
      id: `col-${Date.now()}`,
      type: newColumn.type as FRWColumnType || 'actual',
      label: newColumn.label || 'New Column',
      header1: newColumn.header1,
      header2: newColumn.header2,
      reportingPeriod: newColumn.reportingPeriod || 'current-year',
      expandBy: newColumn.expandBy || 'none',
      showAs: newColumn.showAs || 'currency',
      precision: 2,
      hidden: false,
      order: definition.columns.length,
    };

    setDefinition((prev) => ({
      ...prev,
      columns: [...prev.columns, newCol],
    }));
    setIsDirty(true);
    setShowAddColumnDialog(false);
    setNewColumn({
      type: 'actual',
      label: 'New Column',
      reportingPeriod: 'current-year',
      showAs: 'currency',
      expandBy: 'none',
      hidden: false,
    });
  };

  // Update a column
  const updateColumn = (columnId: string, updates: Partial<FRWColumn>) => {
    setDefinition((prev) => ({
      ...prev,
      columns: prev.columns.map((c) =>
        c.id === columnId ? { ...c, ...updates } : c
      ),
    }));
    setIsDirty(true);
  };

  // Delete a column
  const deleteColumn = (columnId: string) => {
    setDefinition((prev) => ({
      ...prev,
      columns: prev.columns.filter(c => c.id !== columnId),
    }));
    setIsDirty(true);
  };

  // Move column up/down
  const moveColumn = (columnId: string, direction: 'up' | 'down') => {
    const columns = [...definition.columns];
    const index = columns.findIndex(c => c.id === columnId);
    if (direction === 'up' && index > 0) {
      [columns[index - 1], columns[index]] = [columns[index], columns[index - 1]];
    } else if (direction === 'down' && index < columns.length - 1) {
      [columns[index], columns[index + 1]] = [columns[index + 1], columns[index]];
    }
    setDefinition((prev) => ({ ...prev, columns }));
    setIsDirty(true);
  };

  // Add a new row group
  const addRowGroup = () => {
    const newGroup: FRWAccountGroup = {
      id: `group-${Date.now()}`,
      name: 'New Group',
      type: 'group',
      detailLevel: 'summary',
      basisForAmounts: 'cumulative',
      alwaysDisplay: true,
      printTotal: true,
    };

    setDefinition((prev) => ({
      ...prev,
      rowStructure: [...prev.rowStructure, newGroup],
    }));
    setIsDirty(true);
    setShowAddRowDialog(false);
  };

  // Save report
  const saveReport = () => {
    const reportToSave = {
      ...definition,
      id: definition.id || `report-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };

    if (!reportToSave.createdAt) {
      reportToSave.createdAt = reportToSave.updatedAt;
    }

    // Save to localStorage
    const saved = localStorage.getItem('frw_reports');
    const reports: FRWReportDefinition[] = saved ? JSON.parse(saved) : [];
    const existingIndex = reports.findIndex(r => r.id === reportToSave.id);

    if (existingIndex >= 0) {
      reports[existingIndex] = reportToSave;
    } else {
      reports.push(reportToSave);
    }

    localStorage.setItem('frw_reports', JSON.stringify(reports));
    setDefinition(reportToSave);
    setIsDirty(false);
    alert('Report saved successfully!');
  };

  /**
   * Calculate net balance for an account based on normal balance rules.
   *
   * Normal Balance determines how the balance should be displayed:
   * - DEBIT normal balance (Assets, Expenses): Positive when Debits > Credits
   * - CREDIT normal balance (Liabilities, Equity, Revenue): Positive when Credits > Debits
   *
   * The net balance is always displayed as a single value (positive or negative),
   * not as separate debit/credit columns.
   */
  const calculateNetBalance = (
    debits: number,
    credits: number,
    normalBalance: 'DEBIT' | 'CREDIT'
  ): number => {
    if (normalBalance === 'DEBIT') {
      // For debit-normal accounts: positive when debits exceed credits
      return debits - credits;
    } else {
      // For credit-normal accounts: positive when credits exceed debits
      return credits - debits;
    }
  };

  /**
   * Get the expected normal balance for an account type.
   * This is used when the normalBalance field is not available.
   */
  const getDefaultNormalBalance = (accountType: string): 'DEBIT' | 'CREDIT' => {
    switch (accountType) {
      case 'ASSET':
      case 'EXPENSE':
        return 'DEBIT';
      case 'LIABILITY':
      case 'EQUITY':
      case 'REVENUE':
        return 'CREDIT';
      default:
        return 'DEBIT';
    }
  };

  // Helper to get month names
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];

  // Map expandBy values to dimension type codes
  const expandByToDimensionCode: Record<string, string> = {
    'departments': 'DEPARTMENT',
    'locations': 'LOCATION',
    'projects': 'PROJECT',
  };

  // Expand columns based on expandBy setting
  const expandColumns = (columns: FRWColumn[]): FRWColumn[] => {
    const expandedColumns: FRWColumn[] = [];

    for (const col of columns) {
      if (col.expandBy === 'months' && (col.type === 'actual' || col.type === 'budget')) {
        // Expand into 12 monthly columns
        for (let i = 0; i < 12; i++) {
          expandedColumns.push({
            ...col,
            id: `${col.id}-month-${i}`,
            label: monthNames[i],
            header1: col.label,
            header2: monthNames[i],
            expandBy: 'none', // Don't re-expand
            _monthIndex: i, // Internal tracking
          } as FRWColumn & { _monthIndex: number });
        }
        // Add a total column
        expandedColumns.push({
          ...col,
          id: `${col.id}-total`,
          label: 'Total',
          header1: col.label,
          header2: 'Total',
          expandBy: 'none',
          _isTotal: true,
        } as FRWColumn & { _isTotal: boolean });
      } else if (col.expandBy === 'quarters' && (col.type === 'actual' || col.type === 'budget')) {
        // Expand into 4 quarterly columns
        for (let i = 0; i < 4; i++) {
          expandedColumns.push({
            ...col,
            id: `${col.id}-quarter-${i}`,
            label: quarterNames[i],
            header1: col.label,
            header2: quarterNames[i],
            expandBy: 'none',
            _quarterIndex: i,
          } as FRWColumn & { _quarterIndex: number });
        }
        // Add a total column
        expandedColumns.push({
          ...col,
          id: `${col.id}-total`,
          label: 'Total',
          header1: col.label,
          header2: 'Total',
          expandBy: 'none',
          _isTotal: true,
        } as FRWColumn & { _isTotal: boolean });
      } else if (
        (col.expandBy === 'departments' || col.expandBy === 'locations' || col.expandBy === 'projects') &&
        (col.type === 'actual' || col.type === 'budget')
      ) {
        // Expand by dimension
        const dimensionCode = expandByToDimensionCode[col.expandBy];
        const dimType = dimensionTypes.find(dt => dt.code === dimensionCode);
        const dimValues = dimensionValues.filter(dv => dv.dimensionTypeCode === dimensionCode);

        if (dimValues.length > 0) {
          // Add a column for each dimension value
          dimValues.forEach((dv, idx) => {
            expandedColumns.push({
              ...col,
              id: `${col.id}-dim-${dv.id}`,
              label: dv.name,
              header1: col.label,
              header2: dv.name,
              expandBy: 'none',
              _dimensionValueId: dv.id,
              _dimensionTypeCode: dimensionCode,
            } as FRWColumn & { _dimensionValueId: string; _dimensionTypeCode: string });
          });

          // Add 'Unassigned' column for entries without this dimension
          expandedColumns.push({
            ...col,
            id: `${col.id}-dim-unassigned`,
            label: 'Unassigned',
            header1: col.label,
            header2: 'Unassigned',
            expandBy: 'none',
            _dimensionUnassigned: true,
            _dimensionTypeCode: dimensionCode,
          } as FRWColumn & { _dimensionUnassigned: boolean; _dimensionTypeCode: string });

          // Add a total column
          expandedColumns.push({
            ...col,
            id: `${col.id}-total`,
            label: 'Total',
            header1: col.label,
            header2: 'Total',
            expandBy: 'none',
            _isTotal: true,
          } as FRWColumn & { _isTotal: boolean });
        } else {
          // No dimension values found, just use the column as-is
          expandedColumns.push(col);
        }
      } else {
        expandedColumns.push(col);
      }
    }

    return expandedColumns;
  };

  // Generate preview
  const generatePreview = async () => {
    setPreviewLoading(true);
    setActiveTab('preview');

    try {
      // Get account data from API
      const accounts = await api.getAccounts();

      // Expand columns based on expandBy settings
      const expandedColumns = expandColumns(definition.columns);

      // Determine date range from definition
      // Default to 2025 for now as that's where the imported journal data is
      // TODO: Add a proper year/period selector to the report writer UI
      const year = 2025;
      const startDate = (definition as any).period?.startDate || `${year}-01-01`;
      const endDate = (definition as any).period?.endDate || `${year}-12-31`;

      // Get real account balances from ledger postings
      const balancesResponse = await api.getAccountBalances({
        startDate,
        endDate,
        includeMonthly: expandedColumns.some((col: FRWColumn) =>
          (col as any)._monthIndex !== undefined || (col as any)._quarterIndex !== undefined
        ),
      });

      // Create a map of account balances from real data
      const accountBalances = new Map<string, {
        debits: number;
        credits: number;
        monthlyBalances: { debits: number; credits: number }[];
        dimensionBalances: Record<string, { debits: number; credits: number }>;
      }>();

      // Build account balance map from API response
      balancesResponse.accounts.forEach(bal => {
        const debits = parseFloat(bal.debits) || 0;
        const credits = parseFloat(bal.credits) || 0;

        // Build monthly balances array (12 months)
        const monthlyBalances: { debits: number; credits: number }[] = [];
        for (let m = 0; m < 12; m++) {
          const monthData = bal.monthlyBalances?.find(mb => mb.month === m);
          monthlyBalances.push({
            debits: monthData ? parseFloat(monthData.debits) || 0 : 0,
            credits: monthData ? parseFloat(monthData.credits) || 0 : 0,
          });
        }

        // Dimension balances (for now, distribute based on proportions - will be enhanced later)
        const dimensionBalances: Record<string, { debits: number; credits: number }> = {};
        dimensionValues.forEach((dv, idx) => {
          // For now, distribute proportionally until we have dimension-specific data
          const allocation = dimensionValues.length > 0 ? 1 / dimensionValues.length : 0;
          dimensionBalances[dv.id] = {
            debits: debits * allocation,
            credits: credits * allocation,
          };
        });

        accountBalances.set(bal.accountId, { debits, credits, monthlyBalances, dimensionBalances });
      });

      // Generate report data based on definition
      const rows: FRWReportRow[] = [];
      let rowId = 0;

      // Helper to calculate values for expanded columns
      const calculateExpandedValues = (
        balance: { debits: number; credits: number; monthlyBalances: { debits: number; credits: number }[]; dimensionBalances?: Record<string, { debits: number; credits: number }> } | undefined,
        normalBalance: 'DEBIT' | 'CREDIT',
        columns: FRWColumn[]
      ): Record<string, number> => {
        const values: Record<string, number> = {};

        if (!balance) return values;

        columns.forEach(col => {
          if (col.type === 'account-name' || col.type === 'account-number' || col.type === 'spacer') {
            return;
          }

          const extCol = col as FRWColumn & {
            _monthIndex?: number;
            _quarterIndex?: number;
            _isTotal?: boolean;
            _dimensionValueId?: string;
            _dimensionUnassigned?: boolean;
            _dimensionTypeCode?: string;
          };

          if (extCol._monthIndex !== undefined) {
            // Monthly column
            const monthBal = balance.monthlyBalances[extCol._monthIndex];
            values[col.id] = calculateNetBalance(monthBal.debits, monthBal.credits, normalBalance);
          } else if (extCol._quarterIndex !== undefined) {
            // Quarterly column - sum 3 months
            const startMonth = extCol._quarterIndex * 3;
            let qDebits = 0;
            let qCredits = 0;
            for (let m = startMonth; m < startMonth + 3; m++) {
              qDebits += balance.monthlyBalances[m].debits;
              qCredits += balance.monthlyBalances[m].credits;
            }
            values[col.id] = calculateNetBalance(qDebits, qCredits, normalBalance);
          } else if (extCol._dimensionValueId !== undefined && balance.dimensionBalances) {
            // Dimension-specific column
            const dimBal = balance.dimensionBalances[extCol._dimensionValueId];
            if (dimBal) {
              values[col.id] = calculateNetBalance(dimBal.debits, dimBal.credits, normalBalance);
            } else {
              values[col.id] = 0;
            }
          } else if (extCol._dimensionUnassigned && balance.dimensionBalances) {
            // Unassigned dimension column - calculate as total minus sum of assigned
            const totalBal = calculateNetBalance(balance.debits, balance.credits, normalBalance);
            let assignedTotal = 0;
            Object.values(balance.dimensionBalances).forEach(dimBal => {
              assignedTotal += calculateNetBalance(dimBal.debits, dimBal.credits, normalBalance);
            });
            values[col.id] = totalBal - assignedTotal;
          } else if (extCol._isTotal) {
            // Total column
            values[col.id] = calculateNetBalance(balance.debits, balance.credits, normalBalance);
          } else {
            // Regular column
            values[col.id] = calculateNetBalance(balance.debits, balance.credits, normalBalance);
          }
        });

        return values;
      };

      // Helper to sum values across accounts
      const sumAccountValues = (
        accountIds: string[],
        columns: FRWColumn[]
      ): Record<string, number> => {
        const totals: Record<string, number> = {};

        accountIds.forEach(accId => {
          const acc = accounts.find(a => a.id === accId);
          if (!acc) return;

          const balance = accountBalances.get(accId);
          const normalBalance = acc.normalBalance || getDefaultNormalBalance(acc.accountType);
          const accValues = calculateExpandedValues(balance, normalBalance, columns);

          Object.entries(accValues).forEach(([colId, val]) => {
            totals[colId] = (totals[colId] || 0) + val;
          });
        });

        return totals;
      };

      const generateRowsFromGroups = (groups: FRWAccountGroup[], level: number): { rows: FRWReportRow[]; totals: Record<string, number> } => {
        const result: FRWReportRow[] = [];
        const sectionTotals: Record<string, number> = {};

        for (const group of groups) {
          // Find matching accounts for this group
          let matchingAccounts = accounts.filter(a => {
            if (group.accountCodeRange) {
              const code = a.accountCode || '';
              return code >= group.accountCodeRange.start && code <= group.accountCodeRange.end;
            } else if (group.accountType) {
              return a.accountType === group.accountType;
            }
            return false;
          });

          // Calculate group totals with expanded columns
          const matchingIds = matchingAccounts.map(a => a.id);
          const groupTotals = sumAccountValues(matchingIds, expandedColumns);

          // Process children first to get their totals
          let childTotals: Record<string, number> = {};
          let childRows: FRWReportRow[] = [];
          if (group.children && group.expanded !== false) {
            const childResult = generateRowsFromGroups(group.children, level + 1);
            childRows = childResult.rows;
            childTotals = childResult.totals;
          }

          // Use children totals if available, otherwise use direct account totals
          const displayTotals = group.children?.length ? childTotals : groupTotals;

          // Accumulate into section totals
          Object.entries(displayTotals).forEach(([colId, val]) => {
            sectionTotals[colId] = (sectionTotals[colId] || 0) + val;
          });

          // Add group header
          const headerRow: FRWReportRow = {
            id: `row-${rowId++}`,
            rowType: group.type === 'section' ? 'section-header' : 'group-header',
            level,
            indent: level,
            label: group.name,
            values: { ...displayTotals },
            isExpandable: !!group.children?.length,
            isExpanded: group.expanded !== false,
            isBold: group.type === 'section',
          };

          result.push(headerRow);

          // Add child rows
          if (childRows.length > 0) {
            result.push(...childRows);
          }

          // Add detail accounts if detail level is 'detail'
          if (group.detailLevel === 'detail' && group.accountCodeRange) {
            matchingAccounts.forEach(a => {
              const balance = accountBalances.get(a.id);
              const normalBalance = a.normalBalance || getDefaultNormalBalance(a.accountType);
              const accValues = calculateExpandedValues(balance, normalBalance, expandedColumns);

              const accountRow: FRWReportRow = {
                id: `row-${rowId++}`,
                rowType: 'account',
                level: level + 1,
                indent: level + 1,
                label: a.title,
                accountCode: a.accountCode,
                accountId: a.id,
                values: accValues,
              };

              result.push(accountRow);
            });
          }

          // Add subtotal if printTotal
          if (group.printTotal && (group.children?.length || group.detailLevel === 'detail')) {
            const subtotalRow: FRWReportRow = {
              id: `row-${rowId++}`,
              rowType: 'subtotal',
              level,
              indent: level,
              label: `Total ${group.name}`,
              values: { ...displayTotals },
              isBold: true,
            };

            result.push(subtotalRow);
          }
        }

        return { rows: result, totals: sectionTotals };
      };

      const { rows: generatedRows } = generateRowsFromGroups(definition.rowStructure, 0);

      // Generate period label based on selected parameters
      const generatePeriodLabel = (): string => {
        const asOf = new Date(reportAsOfDate);
        const month = asOf.toLocaleString('default', { month: 'long' });
        const year = asOf.getFullYear();

        switch (reportPeriodType) {
          case 'month':
            return `For the Month of ${month} ${year}`;
          case 'quarter': {
            const q = Math.floor(asOf.getMonth() / 3) + 1;
            return `For Q${q} ${year}`;
          }
          case 'year':
            return `For the Year Ended ${month} ${asOf.getDate()}, ${year}`;
          case 'ytd':
            return `Year to Date as of ${month} ${asOf.getDate()}, ${year}`;
          case 'custom':
            if (reportStartDate && reportEndDate) {
              return `${new Date(reportStartDate).toLocaleDateString()} through ${new Date(reportEndDate).toLocaleDateString()}`;
            }
            return `As of ${asOf.toLocaleDateString()}`;
          default:
            return `As of ${asOf.toLocaleDateString()}`;
        }
      };

      const report: FRWGeneratedReport = {
        definition: { ...definition, columns: expandedColumns },
        generatedAt: new Date().toISOString(),
        orgName: 'At Home Solutions LLC',
        periodLabel: generatePeriodLabel(),
        columnHeaders: expandedColumns.map(c => ({
          id: c.id,
          label: c.label,
          header1: c.header1,
          header2: c.header2,
        })),
        rows: generatedRows,
        metadata: {
          totalRows: generatedRows.length,
          executionTimeMs: 150,
        },
      };

      setPreviewData(report);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Change report type
  const changeReportType = (type: 'balance-sheet' | 'income-statement' | 'cash-flow' | 'custom') => {
    if (type === 'income-statement') {
      setDefinition(prev => ({
        ...prev,
        reportType: type,
        name: prev.name === 'Balance Sheet - Condensed' ? 'Income Statement' : prev.name,
        rowStructure: defaultIncomeStatementGroups,
      }));
    } else if (type === 'balance-sheet') {
      setDefinition(prev => ({
        ...prev,
        reportType: type,
        name: prev.name === 'Income Statement' ? 'Balance Sheet - Condensed' : prev.name,
        rowStructure: defaultBalanceSheetGroups,
      }));
    } else {
      setDefinition(prev => ({ ...prev, reportType: type }));
    }
    setIsDirty(true);
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-100">
      {/* Header */}
      <div className="bg-white border-b border-zinc-300 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/reports')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold text-zinc-800">Financial Report Writer</h1>
          {isDirty && <span className="text-xs text-amber-600">(unsaved changes)</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={saveReport}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button size="sm" onClick={() => setShowRunReportDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Play className="h-4 w-4 mr-2" />
            Run Report
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - tabs */}
        <div className="w-36 bg-zinc-50 border-r border-zinc-300 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-3 py-2.5 text-sm border-b border-zinc-200 flex items-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-emerald-700 font-medium border-l-2 border-l-emerald-600'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-auto p-6">
          {/* Report Info Tab */}
          {activeTab === 'report-info' && (
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-emerald-700 mb-4">Report information</h2>
              <div className="space-y-4 bg-white p-6 rounded-lg border border-zinc-200">
                <div>
                  <Label>Report name</Label>
                  <Input
                    value={definition.name}
                    onChange={(e) => {
                      setDefinition((prev) => ({ ...prev, name: e.target.value }));
                      setIsDirty(true);
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={definition.description || ''}
                    onChange={(e) => {
                      setDefinition((prev) => ({ ...prev, description: e.target.value }));
                      setIsDirty(true);
                    }}
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Report type</Label>
                  <Select
                    value={definition.reportType}
                    onValueChange={(value: 'balance-sheet' | 'income-statement' | 'cash-flow' | 'custom') => changeReportType(value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="balance-sheet">Balance Sheet</SelectItem>
                      <SelectItem value="income-statement">Income Statement</SelectItem>
                      <SelectItem value="cash-flow">Cash Flow Statement</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Rows Tab */}
          {activeTab === 'rows' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-emerald-700">
                  Define rows — {definition.name}
                </h2>
                <Button variant="outline" size="sm" onClick={() => setShowAddRowDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row Group
                </Button>
              </div>

              <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="text-left text-xs font-medium text-zinc-500 py-2 px-3 w-1/2">
                        Row structure
                      </th>
                      <th className="text-left text-xs font-medium text-zinc-500 py-2 px-3 w-28">
                        Detail level
                      </th>
                      <th className="text-left text-xs font-medium text-zinc-500 py-2 px-3 w-28">
                        Basis
                      </th>
                      <th className="text-center text-xs font-medium text-zinc-500 py-2 px-3 w-20">
                        Display
                      </th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {definition.rowStructure.map((group) => (
                      <AccountGroupRow
                        key={group.id}
                        group={group}
                        level={0}
                        onToggle={toggleGroup}
                        onUpdate={updateGroup}
                        onDelete={deleteGroup}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Columns Tab */}
          {activeTab === 'columns' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-emerald-700">
                  Add columns — {definition.name}
                </h2>
                <Button onClick={() => setShowAddColumnDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Column
                </Button>
              </div>

              <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Column</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Expand By</TableHead>
                      <TableHead>Show As</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {definition.columns.map((col, index) => (
                      <TableRow key={col.id} className="group">
                        <TableCell className="text-zinc-400">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => moveColumn(col.id, 'up')}
                              disabled={index === 0}
                              className="p-0.5 hover:bg-zinc-100 rounded disabled:opacity-30"
                            >
                              <MoveUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => moveColumn(col.id, 'down')}
                              disabled={index === definition.columns.length - 1}
                              className="p-0.5 hover:bg-zinc-100 rounded disabled:opacity-30"
                            >
                              <MoveDown className="h-3 w-3" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={col.label}
                            onChange={(e) => updateColumn(col.id, { label: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={col.type}
                            onValueChange={(value: FRWColumnType) => updateColumn(col.id, { type: value })}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(columnTypeLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {col.type !== 'account-name' && col.type !== 'account-number' && col.type !== 'spacer' ? (
                            <Select
                              value={col.reportingPeriod}
                              onValueChange={(value) => updateColumn(col.id, { reportingPeriod: value as FRWColumn['reportingPeriod'] })}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="current-year">Current Year</SelectItem>
                                <SelectItem value="prior-year">Prior Year</SelectItem>
                                <SelectItem value="current-month">Current Month</SelectItem>
                                <SelectItem value="ytd">Year to Date</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {col.type === 'actual' || col.type === 'budget' ? (
                            <Select
                              value={col.expandBy || 'none'}
                              onValueChange={(value) => updateColumn(col.id, { expandBy: value as FRWColumn['expandBy'] })}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="months">Months</SelectItem>
                                <SelectItem value="quarters">Quarters</SelectItem>
                                <SelectItem value="departments">Departments</SelectItem>
                                <SelectItem value="locations">Locations</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {col.type !== 'account-name' && col.type !== 'account-number' && col.type !== 'spacer' ? (
                            <Select
                              value={col.showAs}
                              onValueChange={(value) => updateColumn(col.id, { showAs: value as 'number' | 'currency' | 'percent' })}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="currency">Currency</SelectItem>
                                <SelectItem value="percent">Percent</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteColumn(col.id)}
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Computations Tab */}
          {activeTab === 'computations' && (
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-emerald-700 mb-4">Computations</h2>
              <div className="bg-white p-6 rounded-lg border border-zinc-200">
                <p className="text-sm text-zinc-600 mb-4">
                  Define custom calculations that can be used in computation columns.
                </p>
                <div className="text-center py-8 text-zinc-400">
                  <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No computations defined</p>
                  <Button variant="outline" size="sm" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Computation
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Filters Tab */}
          {activeTab === 'filters' && (
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-emerald-700 mb-4">Filters</h2>
              <div className="bg-white p-6 rounded-lg border border-zinc-200 space-y-4">
                <div className="pt-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={definition.filters.excludeZeroBalances}
                      onCheckedChange={(checked) =>
                        setDefinition((prev) => ({
                          ...prev,
                          filters: { ...prev.filters, excludeZeroBalances: !!checked },
                        }))
                      }
                    />
                    <Label className="cursor-pointer">Exclude zero balances</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={definition.filters.excludeInactiveAccounts}
                      onCheckedChange={(checked) =>
                        setDefinition((prev) => ({
                          ...prev,
                          filters: { ...prev.filters, excludeInactiveAccounts: !!checked },
                        }))
                      }
                    />
                    <Label className="cursor-pointer">Exclude inactive accounts</Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Format Tab */}
          {activeTab === 'format' && (
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-emerald-700 mb-4">Format</h2>
              <div className="bg-white p-6 rounded-lg border border-zinc-200 space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={definition.format.showAccountNumbers}
                    onCheckedChange={(checked) =>
                      setDefinition((prev) => ({
                        ...prev,
                        format: { ...prev.format, showAccountNumbers: !!checked },
                      }))
                    }
                  />
                  <Label className="cursor-pointer">Show account numbers</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={definition.format.showHierarchy}
                    onCheckedChange={(checked) =>
                      setDefinition((prev) => ({
                        ...prev,
                        format: { ...prev.format, showHierarchy: !!checked },
                      }))
                    }
                  />
                  <Label className="cursor-pointer">Show hierarchy with indentation</Label>
                </div>
                <div>
                  <Label>Negative number format</Label>
                  <Select
                    value={definition.format.negativeFormat}
                    onValueChange={(value: 'minus' | 'parentheses' | 'red') =>
                      setDefinition((prev) => ({
                        ...prev,
                        format: { ...prev.format, negativeFormat: value },
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minus">-1,234.56</SelectItem>
                      <SelectItem value="parentheses">(1,234.56)</SelectItem>
                      <SelectItem value="red">1,234.56 (red)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Decimal places</Label>
                  <Select
                    value={String(definition.format.decimalPlaces)}
                    onValueChange={(value) =>
                      setDefinition((prev) => ({
                        ...prev,
                        format: { ...prev.format, decimalPlaces: parseInt(value) },
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-emerald-700">
                  Preview — {definition.name}
                </h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={generatePreview} disabled={previewLoading}>
                    {previewLoading ? 'Generating...' : 'Refresh'}
                  </Button>
                  <Button size="sm" onClick={() => setShowRunReportDialog(true)} disabled={previewLoading}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Change Period
                  </Button>
                </div>
              </div>

              {previewLoading ? (
                <div className="bg-white rounded-lg border border-zinc-200 p-12 text-center">
                  <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-zinc-600">Generating report preview...</p>
                </div>
              ) : previewData ? (
                <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                  {/* Report header */}
                  <div className="p-4 border-b border-zinc-200 text-center">
                    <h3 className="text-xl font-bold">{previewData.orgName}</h3>
                    <h4 className="text-lg font-semibold text-zinc-700">{previewData.definition.name}</h4>
                    <p className="text-sm text-zinc-500">{previewData.periodLabel}</p>
                  </div>

                  {/* Report table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-zinc-50 border-b border-zinc-200">
                        {/* Group header row for expanded columns */}
                        {previewData.columnHeaders.some(h => h.header1 && h.header2) && (
                          <tr className="border-b border-zinc-100">
                            {(() => {
                              const groups: { label: string; colspan: number; isFirst: boolean }[] = [];
                              let currentGroup = '';
                              let colspan = 0;

                              previewData.columnHeaders.forEach((header, idx) => {
                                if (header.header1) {
                                  if (header.header1 === currentGroup) {
                                    colspan++;
                                  } else {
                                    if (currentGroup) {
                                      groups.push({ label: currentGroup, colspan, isFirst: false });
                                    }
                                    currentGroup = header.header1;
                                    colspan = 1;
                                  }
                                } else {
                                  if (currentGroup) {
                                    groups.push({ label: currentGroup, colspan, isFirst: false });
                                    currentGroup = '';
                                    colspan = 0;
                                  }
                                  groups.push({ label: '', colspan: 1, isFirst: idx === 0 });
                                }
                              });
                              if (currentGroup) {
                                groups.push({ label: currentGroup, colspan, isFirst: false });
                              }

                              return groups.map((g, i) => (
                                <th
                                  key={i}
                                  colSpan={g.colspan}
                                  className={`py-1 px-4 text-xs font-semibold text-zinc-700 ${
                                    g.isFirst ? 'text-left' : 'text-center'
                                  } ${g.label ? 'border-b border-zinc-300 bg-zinc-100' : ''}`}
                                >
                                  {g.label}
                                </th>
                              ));
                            })()}
                          </tr>
                        )}
                        <tr>
                          {previewData.columnHeaders.map((header, idx) => (
                            <th
                              key={header.id}
                              className={`py-2 px-4 text-xs font-medium text-zinc-500 ${
                                idx === 0 ? 'text-left' : 'text-right'
                              }`}
                            >
                              {header.header2 || header.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows.map((row) => (
                          <tr
                            key={row.id}
                            className={`border-b border-zinc-100 ${
                              row.rowType === 'section-header' ? 'bg-zinc-100' :
                              row.rowType === 'subtotal' || row.rowType === 'total' ? 'bg-zinc-50' : ''
                            }`}
                          >
                            {previewData.columnHeaders.map((header, colIdx) => {
                              const isFirstColumn = colIdx === 0;
                              const isDataColumn = !isFirstColumn;

                              return (
                                <td
                                  key={header.id}
                                  className={`py-2 px-4 text-sm ${
                                    isFirstColumn ? 'text-left' : 'text-right font-mono text-xs'
                                  } ${row.isBold ? 'font-semibold' : ''}`}
                                  style={isFirstColumn && definition.format.showHierarchy ? {
                                    paddingLeft: `${row.indent * definition.format.indentAmount + 16}px`
                                  } : undefined}
                                >
                                  {isFirstColumn ? (
                                    <>
                                      {definition.format.showAccountNumbers && row.accountCode && (
                                        <span className="text-zinc-400 mr-2">{row.accountCode}</span>
                                      )}
                                      {row.label}
                                    </>
                                  ) : (
                                    row.values[header.id] !== undefined && row.values[header.id] !== null
                                      ? formatCurrency(row.values[header.id] as number, definition.format)
                                      : ''
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Report footer */}
                  <div className="p-4 border-t border-zinc-200 text-xs text-zinc-400">
                    Generated: {new Date(previewData.generatedAt).toLocaleString()} |
                    {previewData.metadata.totalRows} rows |
                    {previewData.metadata.executionTimeMs}ms
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-zinc-200 p-12 text-center">
                  <Eye className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
                  <h3 className="text-lg font-medium text-zinc-700 mb-2">No Preview Generated</h3>
                  <p className="text-sm text-zinc-500 mb-4">
                    Click "Run Report" to select a reporting period and generate a preview.
                  </p>
                  <Button onClick={() => setShowRunReportDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
                    <Play className="h-4 w-4 mr-2" />
                    Run Report
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Column Dialog */}
      <Dialog open={showAddColumnDialog} onOpenChange={setShowAddColumnDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Column</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Column Label</Label>
              <Input
                value={newColumn.label || ''}
                onChange={(e) => setNewColumn({ ...newColumn, label: e.target.value })}
                className="mt-1"
                placeholder="e.g., Current Year"
              />
            </div>
            <div>
              <Label>Column Type</Label>
              <Select
                value={newColumn.type || 'actual'}
                onValueChange={(value) => setNewColumn({ ...newColumn, type: value as FRWColumnType })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(columnTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newColumn.type !== 'account-name' && newColumn.type !== 'account-number' && newColumn.type !== 'spacer' && (
              <>
                <div>
                  <Label>Reporting Period</Label>
                  <Select
                    value={newColumn.reportingPeriod || 'current-year'}
                    onValueChange={(value) => setNewColumn({ ...newColumn, reportingPeriod: value as FRWColumn['reportingPeriod'] })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current-year">Current Year</SelectItem>
                      <SelectItem value="prior-year">Prior Year</SelectItem>
                      <SelectItem value="current-month">Current Month</SelectItem>
                      <SelectItem value="ytd">Year to Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Show As</Label>
                  <Select
                    value={newColumn.showAs || 'currency'}
                    onValueChange={(value) => setNewColumn({ ...newColumn, showAs: value as 'number' | 'currency' | 'percent' })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="currency">Currency</SelectItem>
                      <SelectItem value="percent">Percent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddColumnDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addColumn} className="bg-emerald-600 hover:bg-emerald-700">
              Add Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Row Group Dialog */}
      <Dialog open={showAddRowDialog} onOpenChange={setShowAddRowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Row Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-zinc-600">
              Add a new account group to define which accounts appear in this section of the report.
            </p>
            <div>
              <Label>Group Type</Label>
              <Select defaultValue="group">
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="section">Section (top-level)</SelectItem>
                  <SelectItem value="group">Account Group</SelectItem>
                  <SelectItem value="computed">Computed Row</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Account Type</Label>
              <Select defaultValue="ASSET">
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSET">Assets</SelectItem>
                  <SelectItem value="LIABILITY">Liabilities</SelectItem>
                  <SelectItem value="EQUITY">Equity</SelectItem>
                  <SelectItem value="REVENUE">Revenue</SelectItem>
                  <SelectItem value="EXPENSE">Expenses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addRowGroup} className="bg-emerald-600 hover:bg-emerald-700">
              Add Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Report Dialog */}
      <Dialog open={showRunReportDialog} onOpenChange={setShowRunReportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              Run Report
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-zinc-600">
              Select the reporting period for this report.
            </p>

            <div>
              <Label>Period Type</Label>
              <Select
                value={reportPeriodType}
                onValueChange={(value: 'month' | 'quarter' | 'year' | 'ytd' | 'custom') => setReportPeriodType(value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Single Month</SelectItem>
                  <SelectItem value="quarter">Quarter</SelectItem>
                  <SelectItem value="year">Full Year</SelectItem>
                  <SelectItem value="ytd">Year to Date</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>As of Date</Label>
              <Input
                type="date"
                value={reportAsOfDate}
                onChange={(e) => setReportAsOfDate(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {reportPeriodType === 'month' && 'Report will show data for the month containing this date'}
                {reportPeriodType === 'quarter' && 'Report will show data for the quarter containing this date'}
                {reportPeriodType === 'year' && 'Report will show data for the fiscal year containing this date'}
                {reportPeriodType === 'ytd' && 'Report will show data from start of year through this date'}
                {reportPeriodType === 'custom' && 'Enter custom start and end dates below'}
              </p>
            </div>

            {reportPeriodType === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Period Preview */}
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-zinc-500" />
                <div>
                  <p className="text-sm font-medium text-zinc-700">
                    {(() => {
                      const asOf = new Date(reportAsOfDate);
                      const month = asOf.toLocaleString('default', { month: 'long' });
                      const year = asOf.getFullYear();

                      if (reportPeriodType === 'month') {
                        return `${month} ${year}`;
                      } else if (reportPeriodType === 'quarter') {
                        const q = Math.floor(asOf.getMonth() / 3) + 1;
                        return `Q${q} ${year}`;
                      } else if (reportPeriodType === 'year') {
                        return `FY ${year}`;
                      } else if (reportPeriodType === 'ytd') {
                        return `Jan 1 - ${month} ${asOf.getDate()}, ${year}`;
                      } else if (reportPeriodType === 'custom' && reportStartDate && reportEndDate) {
                        return `${new Date(reportStartDate).toLocaleDateString()} - ${new Date(reportEndDate).toLocaleDateString()}`;
                      }
                      return 'Select a period';
                    })()}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRunReportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowRunReportDialog(false);
                generatePreview();
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
