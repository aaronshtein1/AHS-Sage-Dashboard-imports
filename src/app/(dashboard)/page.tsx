'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { AccountingPeriod, JournalEntry, BankTransaction } from '@/types';
import {
  Calendar,
  Wallet,
  FileText,
  Building2,
  CreditCard,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Landmark,
  Receipt,
  Users,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';

type DatePreset = 'today' | 'this-week' | 'this-month' | 'last-month' | 'this-quarter' | 'ytd' | 'custom';

interface DateRange {
  startDate: string;
  endDate: string;
  preset: DatePreset;
}

const getDatePreset = (preset: DatePreset): { startDate: string; endDate: string } => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { startDate: formatDate(today), endDate: formatDate(today) };
    case 'this-week': {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return { startDate: formatDate(startOfWeek), endDate: formatDate(today) };
    }
    case 'this-month':
      return {
        startDate: formatDate(new Date(year, month, 1)),
        endDate: formatDate(today),
      };
    case 'last-month':
      return {
        startDate: formatDate(new Date(year, month - 1, 1)),
        endDate: formatDate(new Date(year, month, 0)),
      };
    case 'this-quarter': {
      const quarterStart = Math.floor(month / 3) * 3;
      return {
        startDate: formatDate(new Date(year, quarterStart, 1)),
        endDate: formatDate(today),
      };
    }
    case 'ytd':
      return {
        startDate: formatDate(new Date(year, 0, 1)),
        endDate: formatDate(today),
      };
    case 'custom':
    default:
      return {
        startDate: formatDate(new Date(year, month, 1)),
        endDate: formatDate(today),
      };
  }
};

const presetLabels: Record<DatePreset, string> = {
  'today': 'Today',
  'this-week': 'This Week',
  'this-month': 'This Month',
  'last-month': 'Last Month',
  'this-quarter': 'This Quarter',
  'ytd': 'Year to Date',
  'custom': 'Custom Range',
};

interface DashboardMetrics {
  cashBalance: number;
  revenue: number;
  expenses: number;
  netIncome: number;
  accountsReceivable: number;
  accountsPayable: number;
  bankTransactionsPending: number;
  draftJournals: number;
}

export default function DashboardPage() {
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentJournals, setRecentJournals] = useState<JournalEntry[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<BankTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Initialize with YTD as default
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    ...getDatePreset('ytd'),
    preset: 'ytd',
  }));

  // Temporary state for custom date picker (only applies on Apply click)
  const [tempCustomDates, setTempCustomDates] = useState({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  // Close date picker when clicking outside (cancel without applying)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
        // Reset temp dates to current applied dates
        setTempCustomDates({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        });
      }
    };
    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDatePicker, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    loadDashboardData();
  }, [dateRange.startDate, dateRange.endDate]);

  const handlePresetChange = (preset: DatePreset) => {
    if (preset === 'custom') {
      // Just switch to custom mode, don't close picker
      setTempCustomDates({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
    } else {
      setShowDatePicker(false);
      const dates = getDatePreset(preset);
      setDateRange({ ...dates, preset });
      setTempCustomDates(dates);
    }
  };

  const handleCustomDateChange = (field: 'startDate' | 'endDate', value: string) => {
    // Only update temp state, not the actual dateRange
    setTempCustomDates(prev => ({ ...prev, [field]: value }));
  };

  const handleApplyCustomDates = () => {
    setDateRange({
      ...tempCustomDates,
      preset: 'custom',
    });
    setShowDatePicker(false);
  };

  const dateRangeLabel = useMemo(() => {
    if (dateRange.preset !== 'custom') {
      return presetLabels[dateRange.preset];
    }
    const start = new Date(dateRange.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const end = new Date(dateRange.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  }, [dateRange]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Load all data in parallel with date filters
      const [periodsData, journalsData, transactionsData, trialBalanceData] = await Promise.all([
        api.getPeriods().catch(() => []),
        api.getJournals({ startDate: dateRange.startDate, endDate: dateRange.endDate }).catch(() => []),
        api.getBankTransactions({ startDate: dateRange.startDate, endDate: dateRange.endDate, status: 'unmatched' }).catch(() => []),
        api.getTrialBalance(dateRange.endDate).catch(() => null),
      ]);

      setPeriods(Array.isArray(periodsData) ? periodsData : []);
      setRecentJournals(Array.isArray(journalsData) ? journalsData.slice(0, 5) : []);
      setPendingTransactions(Array.isArray(transactionsData) ? transactionsData.slice(0, 5) : []);

      // Calculate metrics from trial balance
      const metricsData: DashboardMetrics = {
        cashBalance: 0,
        revenue: 0,
        expenses: 0,
        netIncome: 0,
        accountsReceivable: 0,
        accountsPayable: 0,
        bankTransactionsPending: Array.isArray(transactionsData) ? transactionsData.length : 0,
        draftJournals: Array.isArray(journalsData)
          ? journalsData.filter((j: JournalEntry) => j.status?.toUpperCase() === 'DRAFT').length
          : 0,
      };

      // Debug: log the trial balance data
      console.log('Trial Balance Data:', trialBalanceData);

      if (trialBalanceData?.rows && trialBalanceData.rows.length > 0) {
        console.log('Trial Balance Rows count:', trialBalanceData.rows.length);
        console.log('Sample row:', trialBalanceData.rows[0]);

        for (const row of trialBalanceData.rows) {
          const rowAny = row as any; // Handle variations in data shape
          const accountCode = (row.accountCode || rowAny.accountNo || '').toString();
          const accountType = (row.accountType || '').toUpperCase();
          const accountTitle = (row.accountTitle || rowAny.title || '').toLowerCase();

          // Calculate net balance from debit/credit (handle both number and string formats)
          // Parse carefully: strings like "0" should become 0, not fall through
          const debitStr = row.debitBalance ?? rowAny.debit ?? '0';
          const creditStr = row.creditBalance ?? rowAny.credit ?? '0';
          const debit = typeof debitStr === 'string' ? parseFloat(debitStr) : Number(debitStr);
          const credit = typeof creditStr === 'string' ? parseFloat(creditStr) : Number(creditStr);

          // For balance sheet accounts (ASSET, LIABILITY, EQUITY), use net balance
          // For income statement accounts (REVENUE, EXPENSE), also use net balance
          const balance = rowAny.balance !== undefined ? Number(rowAny.balance) : (debit - credit);

          // Use accountType for categorization (most reliable)
          if (accountType === 'ASSET') {
            // Check for specific asset categories
            if (accountTitle.includes('cash') || accountTitle.includes('checking') || accountTitle.includes('savings') || accountTitle.includes('bank')) {
              metricsData.cashBalance += balance;
            } else if (accountTitle.includes('receivable') || accountTitle.includes('a/r') || accountCode.startsWith('11') || accountCode.startsWith('12')) {
              metricsData.accountsReceivable += balance;
            } else {
              // Other assets contribute to cash for now (simplification)
              metricsData.cashBalance += balance;
            }
          } else if (accountType === 'LIABILITY') {
            if (accountTitle.includes('payable') || accountTitle.includes('a/p') || accountCode.startsWith('20')) {
              metricsData.accountsPayable += Math.abs(balance);
            }
          } else if (accountType === 'REVENUE' || accountType === 'INCOME') {
            // Revenue accounts have credit normal balance, so credit > debit = positive revenue
            metricsData.revenue += credit - debit; // Use actual credits minus debits for revenue
          } else if (accountType === 'EXPENSE' || accountType === 'COST') {
            // Expense accounts have debit normal balance
            metricsData.expenses += debit - credit; // Use actual debits minus credits for expenses
          }
          // Fallback to account code patterns if no accountType
          else if (!accountType) {
            if (accountCode.startsWith('10')) {
              metricsData.cashBalance += balance;
            } else if (accountCode.startsWith('11') || accountCode.startsWith('12')) {
              metricsData.accountsReceivable += balance;
            } else if (accountCode.startsWith('20')) {
              metricsData.accountsPayable += Math.abs(balance);
            } else if (accountCode.startsWith('4')) {
              metricsData.revenue += credit - debit;
            } else if (accountCode.startsWith('5') || accountCode.startsWith('6')) {
              metricsData.expenses += debit - credit;
            }
          }
        }
      } else {
        console.log('No trial balance rows available or empty response:', trialBalanceData);
      }

      metricsData.netIncome = metricsData.revenue - metricsData.expenses;
      setMetrics(metricsData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  const currentPeriod = periods.find((p) => p.status === 'open');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-zinc-50 min-h-screen">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"></div>
            <p className="text-sm text-zinc-500">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-zinc-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {currentPeriod ? (
              <>
                {currentPeriod.name} &middot; FY {currentPeriod.fiscalYear}
              </>
            ) : (
              'Financial Overview'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Filter */}
          <div className="relative" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded hover:bg-zinc-50 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              <span>{dateRangeLabel}</span>
              <ChevronDown className="h-3 w-3 text-zinc-400" />
            </button>

            {showDatePicker && (
              <div className="absolute right-0 mt-1 w-64 bg-white border border-zinc-200 rounded-lg shadow-lg z-50">
                <div className="p-2 space-y-1">
                  {(Object.keys(presetLabels) as DatePreset[]).filter(p => p !== 'custom').map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handlePresetChange(preset)}
                      className={`w-full text-left px-3 py-1.5 text-xs rounded transition-colors ${
                        dateRange.preset === preset
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      {presetLabels[preset]}
                    </button>
                  ))}
                </div>
                <div className="border-t border-zinc-100 p-2">
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-2 px-1">Custom Range</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="date"
                        value={tempCustomDates.startDate}
                        onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        type="date"
                        value={tempCustomDates.endDate}
                        onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                </div>
                <div className="border-t border-zinc-100 p-2">
                  <Button
                    size="sm"
                    onClick={handleApplyCustomDates}
                    className="w-full h-7 text-xs bg-zinc-900 hover:bg-zinc-800"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2 text-xs h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Cash Balance */}
        <Card className="p-5 border-zinc-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Cash Balance</span>
            <Wallet className="h-4 w-4 text-zinc-400" />
          </div>
          <p className="text-2xl font-semibold text-zinc-900 tabular-nums">
            {formatCurrency(metrics?.cashBalance || 0)}
          </p>
        </Card>

        {/* Revenue */}
        <Card className="p-5 border-zinc-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Total Revenue</span>
            <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
              {dateRange.preset === 'ytd' ? 'YTD' : dateRange.preset === 'this-month' ? 'MTD' : dateRange.preset === 'this-quarter' ? 'QTD' : 'Period'}
            </span>
          </div>
          <p className="text-2xl font-semibold text-zinc-900 tabular-nums">
            {formatCurrency(metrics?.revenue || 0)}
          </p>
        </Card>

        {/* Expenses */}
        <Card className="p-5 border-zinc-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Total Expenses</span>
            <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
              {dateRange.preset === 'ytd' ? 'YTD' : dateRange.preset === 'this-month' ? 'MTD' : dateRange.preset === 'this-quarter' ? 'QTD' : 'Period'}
            </span>
          </div>
          <p className="text-2xl font-semibold text-zinc-900 tabular-nums">
            {formatCurrency(metrics?.expenses || 0)}
          </p>
        </Card>

        {/* Net Income */}
        <Card className="p-5 border-zinc-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Net Income</span>
            <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
              {dateRange.preset === 'ytd' ? 'YTD' : dateRange.preset === 'this-month' ? 'MTD' : dateRange.preset === 'this-quarter' ? 'QTD' : 'Period'}
            </span>
          </div>
          <p className={`text-2xl font-semibold tabular-nums ${(metrics?.netIncome || 0) >= 0 ? 'text-zinc-900' : 'text-red-600'}`}>
            {formatCurrency(metrics?.netIncome || 0)}
          </p>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-zinc-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Accounts Receivable</p>
              <p className="text-lg font-semibold text-zinc-900 mt-1 tabular-nums">{formatCurrency(metrics?.accountsReceivable || 0)}</p>
            </div>
            <Users className="h-4 w-4 text-zinc-400" />
          </div>
        </Card>

        <Card className="p-4 border-zinc-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Accounts Payable</p>
              <p className="text-lg font-semibold text-zinc-900 mt-1 tabular-nums">{formatCurrency(metrics?.accountsPayable || 0)}</p>
            </div>
            <Receipt className="h-4 w-4 text-zinc-400" />
          </div>
        </Card>

        <Card className="p-4 border-zinc-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Pending Transactions</p>
              <p className="text-lg font-semibold text-zinc-900 mt-1 tabular-nums">{metrics?.bankTransactionsPending || 0}</p>
            </div>
            <CreditCard className="h-4 w-4 text-zinc-400" />
          </div>
        </Card>

        <Card className="p-4 border-zinc-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Draft Journals</p>
              <p className="text-lg font-semibold text-zinc-900 mt-1 tabular-nums">{metrics?.draftJournals || 0}</p>
            </div>
            <FileText className="h-4 w-4 text-zinc-400" />
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card className="lg:col-span-1 p-5 border-zinc-200 bg-white">
          <h3 className="text-sm font-medium text-zinc-900 mb-4 uppercase tracking-wide">Quick Actions</h3>
          <div className="space-y-1">
            <Link
              href="/journals"
              className="flex items-center justify-between p-2.5 rounded hover:bg-zinc-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-zinc-500" />
                <span className="text-sm text-zinc-700 group-hover:text-zinc-900">Create Journal Entry</span>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500" />
            </Link>

            <Link
              href="/bank-feeds"
              className="flex items-center justify-between p-2.5 rounded hover:bg-zinc-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Landmark className="h-4 w-4 text-zinc-500" />
                <span className="text-sm text-zinc-700 group-hover:text-zinc-900">Process Bank Feeds</span>
                {(metrics?.bankTransactionsPending || 0) > 0 && (
                  <span className="text-xs text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                    {metrics?.bankTransactionsPending}
                  </span>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500" />
            </Link>

            <Link
              href="/reconciliation"
              className="flex items-center justify-between p-2.5 rounded hover:bg-zinc-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-zinc-500" />
                <span className="text-sm text-zinc-700 group-hover:text-zinc-900">Reconcile Accounts</span>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500" />
            </Link>

            <Link
              href="/reports"
              className="flex items-center justify-between p-2.5 rounded hover:bg-zinc-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="h-4 w-4 text-zinc-500" />
                <span className="text-sm text-zinc-700 group-hover:text-zinc-900">View Reports</span>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500" />
            </Link>

            <Link
              href="/accounts"
              className="flex items-center justify-between p-2.5 rounded hover:bg-zinc-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-zinc-500" />
                <span className="text-sm text-zinc-700 group-hover:text-zinc-900">Chart of Accounts</span>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500" />
            </Link>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2 p-5 border-zinc-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-900 uppercase tracking-wide">Recent Journal Entries</h3>
            <Link href="/journals" className="text-xs text-zinc-500 hover:text-zinc-700">
              View all
            </Link>
          </div>

          <div className="border border-zinc-200 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Reference</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Description</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Date</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentJournals.length > 0 ? (
                  recentJournals.map((journal, idx) => (
                    <tr
                      key={journal.id}
                      className={`hover:bg-zinc-50 ${idx !== recentJournals.length - 1 ? 'border-b border-zinc-100' : ''}`}
                    >
                      <td className="py-2 px-3 text-zinc-900 font-medium">
                        {journal.referenceNumber || '-'}
                      </td>
                      <td className="py-2 px-3 text-zinc-600 truncate max-w-[200px]">
                        {journal.description || '-'}
                      </td>
                      <td className="py-2 px-3 text-zinc-600 tabular-nums">
                        {formatDate(journal.entryDate)}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          journal.status?.toUpperCase() === 'POSTED'
                            ? 'bg-zinc-100 text-zinc-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {journal.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-zinc-500 text-sm">
                      No recent journal entries
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Pending Bank Transactions & Alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pending Bank Transactions */}
        <Card className="p-5 border-zinc-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-900 uppercase tracking-wide">Pending Transactions</h3>
            <Link href="/bank-feeds" className="text-xs text-zinc-500 hover:text-zinc-700">
              View all
            </Link>
          </div>

          <div className="border border-zinc-200 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Description</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Date</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pendingTransactions.length > 0 ? (
                  pendingTransactions.map((tx, idx) => (
                    <tr
                      key={tx.id}
                      className={`hover:bg-zinc-50 ${idx !== pendingTransactions.length - 1 ? 'border-b border-zinc-100' : ''}`}
                    >
                      <td className="py-2 px-3 text-zinc-700 truncate max-w-[180px]">
                        {tx.name || tx.merchantName || 'Transaction'}
                      </td>
                      <td className="py-2 px-3 text-zinc-600 tabular-nums">
                        {tx.date ? formatDate(tx.date) : '-'}
                      </td>
                      <td className={`py-2 px-3 text-right tabular-nums font-medium ${
                        (tx.amount || 0) >= 0 ? 'text-zinc-900' : 'text-red-600'
                      }`}>
                        {formatCurrency(tx.amount || 0)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-zinc-500 text-sm">
                      All transactions processed
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Alerts & Notifications */}
        <Card className="p-5 border-zinc-200 bg-white">
          <h3 className="text-sm font-medium text-zinc-900 mb-4 uppercase tracking-wide">Notifications</h3>

          <div className="space-y-2">
            {(metrics?.bankTransactionsPending || 0) > 0 && (
              <div className="flex items-center gap-3 p-3 border border-zinc-200 rounded bg-zinc-50">
                <CreditCard className="h-4 w-4 text-zinc-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-zinc-700">
                    <span className="font-medium">{metrics?.bankTransactionsPending}</span> unprocessed bank transactions
                  </p>
                </div>
              </div>
            )}

            {(metrics?.draftJournals || 0) > 0 && (
              <div className="flex items-center gap-3 p-3 border border-zinc-200 rounded bg-zinc-50">
                <FileText className="h-4 w-4 text-zinc-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-zinc-700">
                    <span className="font-medium">{metrics?.draftJournals}</span> draft journal{(metrics?.draftJournals || 0) > 1 ? 's' : ''} pending review
                  </p>
                </div>
              </div>
            )}

            {currentPeriod && (
              <div className="flex items-center gap-3 p-3 border border-zinc-200 rounded bg-zinc-50">
                <Calendar className="h-4 w-4 text-zinc-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-zinc-700">
                    Current period: <span className="font-medium">{currentPeriod.name}</span>
                    <span className="text-zinc-500"> ({currentPeriod.startDate} - {currentPeriod.endDate})</span>
                  </p>
                </div>
              </div>
            )}

            {(metrics?.bankTransactionsPending === 0 && metrics?.draftJournals === 0 && !currentPeriod) && (
              <div className="py-6 text-center text-zinc-500 text-sm">
                No notifications
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Financial Overview - Period History */}
      <Card className="p-5 border-zinc-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-900 uppercase tracking-wide">Accounting Periods</h3>
          <Link href="/settings" className="text-xs text-zinc-500 hover:text-zinc-700">
            Manage
          </Link>
        </div>

        <div className="border border-zinc-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Period</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Fiscal Year</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Start Date</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">End Date</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {periods.length > 0 ? (
                periods.slice(0, 5).map((period, idx) => (
                  <tr key={period.id} className={`hover:bg-zinc-50 ${idx !== Math.min(periods.length - 1, 4) ? 'border-b border-zinc-100' : ''}`}>
                    <td className="py-2 px-3 font-medium text-zinc-900">{period.name}</td>
                    <td className="py-2 px-3 text-zinc-600 tabular-nums">{period.fiscalYear}</td>
                    <td className="py-2 px-3 text-zinc-600 tabular-nums">{period.startDate}</td>
                    <td className="py-2 px-3 text-zinc-600 tabular-nums">{period.endDate}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        period.status === 'open'
                          ? 'bg-zinc-800 text-white'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {period.status === 'open' ? 'Open' : 'Closed'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500 text-sm">
                    No accounting periods configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
