'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { ReportDefinition, GeneratedReport, ReportRow, Account } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  FileText,
  Play,
  Settings2,
  BarChart3,
  FileSpreadsheet,
  PieChart,
  Printer,
  Filter,
  ChevronDown,
  ChevronRight,
  Wand2,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
};

const formatNumber = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num === 0) return '-';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export default function ReportsPage() {
  const [reportDefinitions, setReportDefinitions] = useState<ReportDefinition[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Filter state
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    asOfDate: new Date().toISOString().split('T')[0],
    accountTypes: [] as string[],
    accountCodeStart: '',
    accountCodeEnd: '',
    includeZeroBalances: false,
    includeInactiveAccounts: false,
    groupBy: 'account-type' as 'none' | 'account-type' | 'category',
    showSubtotals: true,
    showGrandTotal: true,
  });

  useEffect(() => {
    loadReportDefinitions();
    loadAccounts();
  }, []);

  const loadReportDefinitions = async () => {
    try {
      const definitions = await api.getReportDefinitions();
      setReportDefinitions(definitions);
      if (definitions.length > 0) {
        setSelectedReport(definitions[0]);
      }
    } catch (error) {
      console.error('Failed to load report definitions:', error);
      // Use mock definitions when API fails
      const mockDefinitions: ReportDefinition[] = [
        {
          id: 'income-statement',
          name: 'Income Statement (P&L)',
          description: 'Revenue, expenses, and net income for a period',
          reportType: 'income-statement',
          filters: {},
        },
        {
          id: 'balance-sheet',
          name: 'Balance Sheet',
          description: 'Assets, liabilities, and equity at a point in time',
          reportType: 'balance-sheet',
          filters: {},
        },
        {
          id: 'cash-flow',
          name: 'Cash Flow Statement',
          description: 'Operating, investing, and financing cash flows',
          reportType: 'cash-flow',
          filters: {},
        },
        {
          id: 'trial-balance',
          name: 'Trial Balance',
          description: 'All accounts with debit and credit balances',
          reportType: 'trial-balance',
          filters: {},
        },
        {
          id: 'general-ledger',
          name: 'General Ledger',
          description: 'Detailed transaction listing by account',
          reportType: 'general-ledger',
          filters: {},
        },
        {
          id: 'account-activity',
          name: 'Account Activity',
          description: 'Activity summary for each account',
          reportType: 'account-activity',
          filters: {},
        },
      ];
      setReportDefinitions(mockDefinitions);
      if (mockDefinitions.length > 0) {
        setSelectedReport(mockDefinitions[0]);
      }
    }
  };

  const loadAccounts = async () => {
    try {
      const accts = await api.getAccounts();
      setAccounts(accts);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      // Use empty array when API fails - accounts are optional for basic report display
      setAccounts([]);
    }
  };

  const runReport = async () => {
    if (!selectedReport) return;

    setIsLoading(true);
    try {
      const definition: ReportDefinition = {
        ...selectedReport,
        filters: {
          ...selectedReport.filters,
          startDate: filters.startDate,
          endDate: filters.endDate,
          asOfDate: filters.asOfDate,
          accountTypes: filters.accountTypes.length > 0 ? filters.accountTypes : undefined,
          accountCodeStart: filters.accountCodeStart || undefined,
          accountCodeEnd: filters.accountCodeEnd || undefined,
          includeZeroBalances: filters.includeZeroBalances,
          includeInactiveAccounts: filters.includeInactiveAccounts,
        },
        groupBy: filters.groupBy,
        showSubtotals: filters.showSubtotals,
        showGrandTotal: filters.showGrandTotal,
      };

      const report = await api.generateReport(definition);
      setGeneratedReport(report);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!generatedReport) return;

    const rows: string[][] = [];

    // Header
    rows.push([generatedReport.definition.name]);
    rows.push([generatedReport.orgName]);
    rows.push([generatedReport.periodLabel]);
    rows.push([]);

    // Column headers based on report type
    if (selectedReport?.reportType === 'general-ledger') {
      rows.push(['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance']);
    } else if (selectedReport?.reportType === 'account-activity') {
      rows.push(['Account', 'Title', 'Opening Balance', 'Debits', 'Credits', 'Net Change', 'Closing Balance']);
    } else {
      rows.push(['Account Number', 'Account Title', 'Debit', 'Credit', 'Balance']);
    }

    // Data rows
    for (const section of generatedReport.sections) {
      rows.push([section.title]);

      for (const row of section.rows) {
        if (selectedReport?.reportType === 'general-ledger') {
          rows.push([
            row.date || '',
            row.description || row.accountTitle || '',
            row.reference || '',
            row.debit,
            row.credit,
            row.balance,
          ]);
        } else if (selectedReport?.reportType === 'account-activity') {
          rows.push([
            row.accountCode || '',
            row.accountTitle || '',
            row.openingBalance || '0',
            row.debit,
            row.credit,
            row.netChange || '0',
            row.closingBalance || row.balance,
          ]);
        } else {
          rows.push([
            row.accountCode || '',
            row.accountTitle || '',
            row.debit,
            row.credit,
            row.balance,
          ]);
        }
      }

      if (section.subtotal) {
        rows.push([
          '',
          section.subtotal.accountTitle || 'Subtotal',
          section.subtotal.debit,
          section.subtotal.credit,
          section.subtotal.balance,
        ]);
      }

      rows.push([]);
    }

    if (generatedReport.grandTotal) {
      rows.push([
        '',
        generatedReport.grandTotal.accountTitle || 'Grand Total',
        generatedReport.grandTotal.debit,
        generatedReport.grandTotal.credit,
        generatedReport.grandTotal.balance,
      ]);
    }

    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedReport?.name?.toLowerCase().replace(/\s+/g, '-') || 'report'}-${filters.asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    window.print();
  };

  const toggleSection = (sectionTitle: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionTitle)) {
      newCollapsed.delete(sectionTitle);
    } else {
      newCollapsed.add(sectionTitle);
    }
    setCollapsedSections(newCollapsed);
  };

  const toggleAccountType = (type: string) => {
    setFilters((prev) => ({
      ...prev,
      accountTypes: prev.accountTypes.includes(type)
        ? prev.accountTypes.filter((t) => t !== type)
        : [...prev.accountTypes, type],
    }));
  };

  const getReportIcon = (reportType: string) => {
    switch (reportType) {
      case 'trial-balance':
        return <BarChart3 className="h-5 w-5" />;
      case 'income-statement':
        return <PieChart className="h-5 w-5" />;
      case 'balance-sheet':
        return <FileSpreadsheet className="h-5 w-5" />;
      case 'cash-flow':
        return <BarChart3 className="h-5 w-5" />;
      case 'general-ledger':
        return <FileText className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const needsDateRange = selectedReport?.reportType === 'income-statement' ||
    selectedReport?.reportType === 'cash-flow' ||
    selectedReport?.reportType === 'general-ledger' ||
    selectedReport?.reportType === 'account-activity';

  return (
    <div className="p-8 print:p-4">
      {/* Header */}
      <div className="mb-6 print:hidden">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Financial Reports</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Generate and customize financial reports
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6 print:block">
        {/* Report Selection Sidebar */}
        <div className="col-span-3 print:hidden">
          {/* Financial Report Writer Link */}
          <Card className="p-4 mb-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <h2 className="font-semibold text-amber-900">Financial Report Writer</h2>
                <p className="text-xs text-amber-700">Advanced report design</p>
              </div>
            </div>
            <p className="text-sm text-amber-800 mb-3">
              Create financial reports with hierarchical rows, multiple columns, dimension expansion, and more.
            </p>
            <Link href="/reports/writer">
              <Button className="w-full bg-amber-600 hover:bg-amber-700">
                <Plus className="h-4 w-4 mr-2" />
                Open Report Writer
              </Button>
            </Link>
          </Card>

          {/* Custom Reports Link */}
          <Card className="p-4 mb-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Wand2 className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <h2 className="font-semibold text-emerald-900">Custom Reports</h2>
                <p className="text-xs text-emerald-700">Build your own reports</p>
              </div>
            </div>
            <p className="text-sm text-emerald-800 mb-3">
              Create custom reports with flexible columns, YTD/MTD periods, comparisons, and more.
            </p>
            <Link href="/reports/custom">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />
                Open Report Builder
              </Button>
            </Link>
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold text-zinc-900 mb-4">Standard Reports</h2>
            <div className="space-y-2">
              {reportDefinitions.map((report) => (
                <button
                  key={report.id}
                  onClick={() => {
                    setSelectedReport(report);
                    setGeneratedReport(null);
                  }}
                  className={`w-full text-left p-3 rounded-lg flex items-start gap-3 transition-colors ${
                    selectedReport?.id === report.id
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'hover:bg-zinc-50 border border-transparent'
                  }`}
                >
                  <div
                    className={`p-2 rounded-md ${
                      selectedReport?.id === report.id
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {getReportIcon(report.reportType)}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-zinc-900">{report.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{report.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="col-span-9 space-y-4 print:col-span-12">
          {/* Filters and Actions */}
          <Card className="p-4 print:hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-zinc-900">
                  {selectedReport?.name || 'Select a Report'}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="text-zinc-500"
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Filters
                  {showFilters ? (
                    <ChevronDown className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronRight className="h-4 w-4 ml-1" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={runReport}
                  disabled={isLoading || !selectedReport}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isLoading ? 'Running...' : 'Run Report'}
                </Button>
                {generatedReport && (
                  <>
                    <Button onClick={exportToCSV} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button onClick={printReport} variant="outline">
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Basic Date Filters - Always visible */}
            <div className="flex items-end gap-4 flex-wrap">
              {needsDateRange ? (
                <>
                  <div className="w-40">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-40">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </>
              ) : (
                <div className="w-40">
                  <Label htmlFor="asOfDate">As of Date</Label>
                  <Input
                    id="asOfDate"
                    type="date"
                    value={filters.asOfDate}
                    onChange={(e) => setFilters({ ...filters, asOfDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-zinc-200 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Account Code Range</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        placeholder="From"
                        value={filters.accountCodeStart}
                        onChange={(e) =>
                          setFilters({ ...filters, accountCodeStart: e.target.value })
                        }
                      />
                      <span className="text-zinc-400">-</span>
                      <Input
                        placeholder="To"
                        value={filters.accountCodeEnd}
                        onChange={(e) =>
                          setFilters({ ...filters, accountCodeEnd: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Group By</Label>
                    <Select
                      value={filters.groupBy}
                      onValueChange={(value: any) =>
                        setFilters({ ...filters, groupBy: value })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Grouping</SelectItem>
                        <SelectItem value="account-type">Account Type</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Account Types</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((type) => (
                        <button
                          key={type}
                          onClick={() => toggleAccountType(type)}
                          className={`px-2 py-1 text-xs rounded-md border ${
                            filters.accountTypes.includes(type)
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                          }`}
                        >
                          {type.charAt(0) + type.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="includeZeroBalances"
                      checked={filters.includeZeroBalances}
                      onCheckedChange={(checked) =>
                        setFilters({ ...filters, includeZeroBalances: !!checked })
                      }
                    />
                    <Label htmlFor="includeZeroBalances" className="cursor-pointer">
                      Include zero balances
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="showSubtotals"
                      checked={filters.showSubtotals}
                      onCheckedChange={(checked) =>
                        setFilters({ ...filters, showSubtotals: !!checked })
                      }
                    />
                    <Label htmlFor="showSubtotals" className="cursor-pointer">
                      Show subtotals
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="showGrandTotal"
                      checked={filters.showGrandTotal}
                      onCheckedChange={(checked) =>
                        setFilters({ ...filters, showGrandTotal: !!checked })
                      }
                    />
                    <Label htmlFor="showGrandTotal" className="cursor-pointer">
                      Show grand total
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Generated Report */}
          {generatedReport && (
            <div className="space-y-4">
              {/* Report Header */}
              <Card className="p-6 text-center print:border-0 print:shadow-none">
                <h2 className="text-2xl font-bold text-zinc-900">
                  {generatedReport.orgName}
                </h2>
                <h3 className="text-xl font-semibold text-zinc-700 mt-1">
                  {generatedReport.definition.name}
                </h3>
                <p className="text-sm text-zinc-500 mt-1">{generatedReport.periodLabel}</p>
                <p className="text-xs text-zinc-400 mt-2">
                  Generated: {new Date(generatedReport.generatedAt).toLocaleString()}
                </p>
              </Card>

              {/* Report Sections */}
              {generatedReport.sections.map((section, sectionIndex) => (
                <Card
                  key={sectionIndex}
                  className="overflow-hidden print:border-0 print:shadow-none print:break-inside-avoid"
                >
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between p-4 bg-zinc-50 hover:bg-zinc-100 transition-colors print:hover:bg-zinc-50"
                  >
                    <h3 className="font-semibold text-zinc-900">{section.title}</h3>
                    <div className="flex items-center gap-2 print:hidden">
                      <span className="text-sm text-zinc-500">
                        {section.rows.length} items
                      </span>
                      {collapsedSections.has(section.title) ? (
                        <ChevronRight className="h-4 w-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-400" />
                      )}
                    </div>
                  </button>

                  {/* Section Content */}
                  {!collapsedSections.has(section.title) && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {selectedReport?.reportType === 'general-ledger' ? (
                            <>
                              <TableHead className="w-28">Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead className="text-right w-32">Debit</TableHead>
                              <TableHead className="text-right w-32">Credit</TableHead>
                              <TableHead className="text-right w-32">Balance</TableHead>
                            </>
                          ) : selectedReport?.reportType === 'account-activity' ? (
                            <>
                              <TableHead className="w-24">Account</TableHead>
                              <TableHead>Title</TableHead>
                              <TableHead className="text-right w-32">Opening</TableHead>
                              <TableHead className="text-right w-32">Debits</TableHead>
                              <TableHead className="text-right w-32">Credits</TableHead>
                              <TableHead className="text-right w-32">Net Change</TableHead>
                              <TableHead className="text-right w-32">Closing</TableHead>
                            </>
                          ) : selectedReport?.reportType === 'trial-balance' ? (
                            // Trial Balance: Show Debit/Credit columns
                            <>
                              <TableHead className="w-24">Account</TableHead>
                              <TableHead>Title</TableHead>
                              <TableHead className="text-right w-32">Debit</TableHead>
                              <TableHead className="text-right w-32">Credit</TableHead>
                            </>
                          ) : (
                            // Income Statement, Balance Sheet, Cash Flow: Show only Amount (net balance)
                            <>
                              <TableHead className="w-24">Account</TableHead>
                              <TableHead>Title</TableHead>
                              <TableHead className="text-right w-40">Amount</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {section.rows.map((row, rowIndex) => (
                          <TableRow
                            key={row.id || rowIndex}
                            className={row.isSubtotal ? 'bg-zinc-50 font-semibold' : ''}
                          >
                            {selectedReport?.reportType === 'general-ledger' ? (
                              <>
                                <TableCell>{row.date}</TableCell>
                                <TableCell
                                  style={{
                                    paddingLeft: row.indent
                                      ? `${row.indent * 1.5 + 1}rem`
                                      : undefined,
                                  }}
                                >
                                  {row.description || row.accountTitle}
                                </TableCell>
                                <TableCell className="text-zinc-500">{row.reference}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatNumber(row.debit)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatNumber(row.credit)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium">
                                  {formatCurrency(row.balance)}
                                </TableCell>
                              </>
                            ) : selectedReport?.reportType === 'account-activity' ? (
                              <>
                                <TableCell className="font-medium">{row.accountCode}</TableCell>
                                <TableCell>{row.accountTitle}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(row.openingBalance || '0')}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatNumber(row.debit)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatNumber(row.credit)}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-mono ${
                                    parseFloat(row.netChange || '0') < 0
                                      ? 'text-red-600'
                                      : parseFloat(row.netChange || '0') > 0
                                      ? 'text-green-600'
                                      : ''
                                  }`}
                                >
                                  {formatCurrency(row.netChange || '0')}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium">
                                  {formatCurrency(row.closingBalance || row.balance)}
                                </TableCell>
                              </>
                            ) : selectedReport?.reportType === 'trial-balance' ? (
                              // Trial Balance: Show Debit/Credit columns
                              <>
                                <TableCell className="font-medium">{row.accountCode}</TableCell>
                                <TableCell
                                  style={{
                                    paddingLeft: row.indent
                                      ? `${row.indent * 1.5 + 1}rem`
                                      : undefined,
                                  }}
                                >
                                  {row.accountTitle}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatNumber(row.debit)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatNumber(row.credit)}
                                </TableCell>
                              </>
                            ) : (
                              // Income Statement, Balance Sheet, Cash Flow: Show only Amount (net balance)
                              <>
                                <TableCell className="font-medium">{row.accountCode}</TableCell>
                                <TableCell
                                  style={{
                                    paddingLeft: row.indent
                                      ? `${row.indent * 1.5 + 1}rem`
                                      : undefined,
                                  }}
                                >
                                  {row.accountTitle}
                                </TableCell>
                                <TableCell className={`text-right font-mono font-medium ${
                                  parseFloat(row.balance || '0') < 0 ? 'text-red-600' : ''
                                }`}>
                                  {formatCurrency(row.balance)}
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}

                        {/* Subtotal Row */}
                        {section.subtotal && (
                          <TableRow className="bg-zinc-100 font-bold border-t-2 border-zinc-300">
                            {selectedReport?.reportType === 'general-ledger' ? (
                              <>
                                <TableCell></TableCell>
                                <TableCell>{section.subtotal.accountTitle}</TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatNumber(section.subtotal.debit)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatNumber(section.subtotal.credit)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(section.subtotal.balance)}
                                </TableCell>
                              </>
                            ) : selectedReport?.reportType === 'account-activity' ? (
                              <>
                                <TableCell></TableCell>
                                <TableCell>{section.subtotal.accountTitle}</TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatNumber(section.subtotal.debit)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatNumber(section.subtotal.credit)}
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(section.subtotal.closingBalance || section.subtotal.balance)}
                                </TableCell>
                              </>
                            ) : selectedReport?.reportType === 'trial-balance' ? (
                              // Trial Balance: Show Debit/Credit columns
                              <>
                                <TableCell></TableCell>
                                <TableCell>{section.subtotal.accountTitle}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatNumber(section.subtotal.debit)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatNumber(section.subtotal.credit)}
                                </TableCell>
                              </>
                            ) : (
                              // Income Statement, Balance Sheet, Cash Flow: Show only Amount (net balance)
                              <>
                                <TableCell></TableCell>
                                <TableCell>{section.subtotal.accountTitle}</TableCell>
                                <TableCell className={`text-right font-mono ${
                                  parseFloat(section.subtotal.balance || '0') < 0 ? 'text-red-600' : ''
                                }`}>
                                  {formatCurrency(section.subtotal.balance)}
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Card>
              ))}

              {/* Grand Total */}
              {generatedReport.grandTotal && (
                <Card className="p-4 bg-emerald-50 border-emerald-200 print:border-0 print:shadow-none">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900">
                      {generatedReport.grandTotal.accountTitle}
                    </span>
                    <div className="flex items-center gap-8 font-mono">
                      {/* Only show Debit/Credit columns for Trial Balance */}
                      {selectedReport?.reportType === 'trial-balance' && (
                        <>
                          <div className="text-right">
                            <div className="text-xs text-emerald-600">Debits</div>
                            <div className="font-bold text-emerald-900">
                              {formatCurrency(generatedReport.grandTotal.debit)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-emerald-600">Credits</div>
                            <div className="font-bold text-emerald-900">
                              {formatCurrency(generatedReport.grandTotal.credit)}
                            </div>
                          </div>
                        </>
                      )}
                      <div className="text-right">
                        <div className="text-xs text-emerald-600">
                          {selectedReport?.reportType === 'trial-balance' ? 'Difference' : 'Total'}
                        </div>
                        <div className={`font-bold text-lg ${
                          parseFloat(generatedReport.grandTotal.balance || '0') < 0
                            ? 'text-red-600'
                            : 'text-emerald-900'
                        }`}>
                          {formatCurrency(generatedReport.grandTotal.balance)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Report Metadata */}
              {generatedReport.metadata && (
                <Card className="p-4 bg-zinc-50 print:hidden">
                  <div className="flex items-center gap-6 text-sm text-zinc-600">
                    <span>
                      <strong>{generatedReport.metadata.totalAccounts}</strong> accounts
                    </span>
                    {generatedReport.metadata.totalTransactions !== undefined && (
                      <span>
                        <strong>{generatedReport.metadata.totalTransactions}</strong> transactions
                      </span>
                    )}
                    {generatedReport.metadata.dateRange && (
                      <span>
                        Period: {generatedReport.metadata.dateRange.start} to{' '}
                        {generatedReport.metadata.dateRange.end}
                      </span>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Empty State */}
          {!generatedReport && !isLoading && selectedReport && (
            <Card className="p-12 text-center print:hidden">
              <FileText className="h-12 w-12 mx-auto text-zinc-400 mb-4" />
              <h3 className="text-lg font-medium text-zinc-900 mb-2">Ready to Generate</h3>
              <p className="text-sm text-zinc-600 mb-4">
                {selectedReport.description}
              </p>
              <Button
                onClick={runReport}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Run {selectedReport.name}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
