'use client';

import { useState } from 'react';
import type { CustomReportDefinition, GeneratedCustomReport, CustomReportRow } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ChevronRight,
  ChevronDown,
  Download,
  Printer,
  RefreshCw,
  FileText,
} from 'lucide-react';

interface ReportPreviewProps {
  definition: CustomReportDefinition;
  report: GeneratedCustomReport | null;
  isLoading: boolean;
  onRefresh: () => void;
  onDrillThrough?: (row: CustomReportRow) => void;
}

const formatValue = (
  value: string | number | null,
  dataType: 'text' | 'number' | 'currency' | 'percent'
): string => {
  if (value === null || value === undefined) return '-';

  if (dataType === 'text') return String(value);

  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';

  switch (dataType) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(num);
    case 'percent':
      return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
    case 'number':
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    default:
      return String(num);
  }
};

export function ReportPreview({
  definition,
  report,
  isLoading,
  onRefresh,
  onDrillThrough,
}: ReportPreviewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const visibleColumns = definition.columns
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order);

  const toggleGroup = (groupId: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(groupId)) {
      newCollapsed.delete(groupId);
    } else {
      newCollapsed.add(groupId);
    }
    setCollapsedGroups(newCollapsed);
  };

  const exportToCSV = () => {
    if (!report) return;

    const headers = visibleColumns.map((c) => c.label);
    const rows = report.rows.map((row) =>
      visibleColumns.map((col) => {
        const value = row.values[col.type];
        return value !== null && value !== undefined ? String(value) : '';
      })
    );

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${definition.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-zinc-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Generating report...</span>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <FileText className="h-12 w-12 text-zinc-300 mb-4" />
        <h3 className="text-lg font-medium text-zinc-700 mb-2">
          No Report Generated
        </h3>
        <p className="text-sm text-zinc-500 mb-4">
          Configure your report settings and click Generate to preview
        </p>
        <Button onClick={onRefresh} className="bg-emerald-600 hover:bg-emerald-700">
          Generate Preview
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Report Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {definition.name || 'Custom Report'}
            </h2>
            <p className="text-sm text-zinc-500">{report.periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
          </div>
        </div>
      </Card>

      {/* Report Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50">
                {visibleColumns.map((col) => (
                  <TableHead
                    key={col.id}
                    className={`
                      ${col.align === 'right' ? 'text-right' : ''}
                      ${col.align === 'center' ? 'text-center' : ''}
                    `}
                    style={{ width: col.width ? `${col.width}px` : undefined }}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((row, index) => (
                <TableRow
                  key={row.id || index}
                  className={`
                    ${row.rowType === 'subtotal' ? 'bg-zinc-50 font-semibold' : ''}
                    ${row.rowType === 'total' ? 'bg-emerald-50 font-bold' : ''}
                    ${onDrillThrough && row.drillThroughParams ? 'cursor-pointer hover:bg-zinc-50' : ''}
                  `}
                  onClick={() => {
                    if (onDrillThrough && row.drillThroughParams) {
                      onDrillThrough(row);
                    }
                  }}
                >
                  {visibleColumns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={`
                        ${col.align === 'right' ? 'text-right font-mono' : ''}
                        ${col.align === 'center' ? 'text-center' : ''}
                        ${col.dataType === 'percent' && Number(row.values[col.type]) < 0 ? 'text-red-600' : ''}
                        ${col.dataType === 'percent' && Number(row.values[col.type]) > 0 ? 'text-green-600' : ''}
                      `}
                      style={{
                        paddingLeft: row.indent && col.type === 'account-title'
                          ? `${row.indent * 1.5 + 1}rem`
                          : undefined,
                      }}
                    >
                      {formatValue(row.values[col.type], col.dataType)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}

              {/* Grand Total */}
              {report.grandTotal && (
                <TableRow className="bg-emerald-100 font-bold border-t-2 border-emerald-300">
                  {visibleColumns.map((col, colIndex) => (
                    <TableCell
                      key={col.id}
                      className={`
                        ${col.align === 'right' ? 'text-right font-mono' : ''}
                        ${col.align === 'center' ? 'text-center' : ''}
                      `}
                    >
                      {colIndex === 0
                        ? 'Grand Total'
                        : col.dataType !== 'text'
                        ? formatValue(report.grandTotal!.values[col.type], col.dataType)
                        : ''}
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Report Metadata */}
      {report.metadata && (
        <Card className="p-3 bg-zinc-50">
          <div className="flex items-center gap-6 text-sm text-zinc-600">
            <span>
              <strong>{report.metadata.totalAccounts}</strong> accounts
            </span>
            {report.metadata.dateRange && (
              <span>
                Period: {report.metadata.dateRange.start} to{' '}
                {report.metadata.dateRange.end}
              </span>
            )}
            <span className="text-zinc-400">
              Generated: {new Date(report.generatedAt).toLocaleString()}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
