'use client';

import type { PeriodConfig, PeriodType } from '@/types';
import {
  getCurrentPeriod,
  getPeriodOptions,
  PERIOD_TYPE_LABELS,
  calculateDateRange,
} from '@/lib/reports/period-utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Info } from 'lucide-react';

interface PeriodSelectorProps {
  config: PeriodConfig;
  onChange: (config: PeriodConfig) => void;
}

export function PeriodSelector({ config, onChange }: PeriodSelectorProps) {
  const periodOptions = getPeriodOptions(24);

  const updateConfig = (updates: Partial<PeriodConfig>) => {
    onChange({ ...config, ...updates });
  };

  // Calculate the effective date range for display
  const dateRange = calculateDateRange(config);

  return (
    <div className="space-y-6">
      {/* Period Type */}
      <div>
        <Label htmlFor="period-type" className="text-sm font-medium">
          Period Type
        </Label>
        <Select
          value={config.type}
          onValueChange={(value: PeriodType) => updateConfig({ type: value })}
        >
          <SelectTrigger id="period-type" className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(PERIOD_TYPE_LABELS) as [PeriodType, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Period Selection based on type */}
      {config.type === 'single' && (
        <div>
          <Label htmlFor="start-period" className="text-sm font-medium">
            Period
          </Label>
          <Select
            value={config.startPeriod || getCurrentPeriod()}
            onValueChange={(value) => updateConfig({ startPeriod: value })}
          >
            <SelectTrigger id="start-period" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {config.type === 'range' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start-period" className="text-sm font-medium">
              Start Period
            </Label>
            <Select
              value={config.startPeriod || getCurrentPeriod()}
              onValueChange={(value) => updateConfig({ startPeriod: value })}
            >
              <SelectTrigger id="start-period" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="end-period" className="text-sm font-medium">
              End Period
            </Label>
            <Select
              value={config.endPeriod || getCurrentPeriod()}
              onValueChange={(value) => updateConfig({ endPeriod: value })}
            >
              <SelectTrigger id="end-period" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {(config.type === 'ytd' ||
        config.type === 'mtd' ||
        config.type === 'qtd' ||
        config.type === 'rolling-12') && (
        <div>
          <Label htmlFor="as-of-period" className="text-sm font-medium">
            As of Period
          </Label>
          <Select
            value={config.startPeriod || getCurrentPeriod()}
            onValueChange={(value) => updateConfig({ startPeriod: value })}
          >
            <SelectTrigger id="as-of-period" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Fiscal Year Start Month */}
      {(config.type === 'ytd' || config.type === 'qtd') && (
        <div>
          <Label htmlFor="fiscal-year-start" className="text-sm font-medium">
            Fiscal Year Start Month
          </Label>
          <Select
            value={String(config.fiscalYearStartMonth || 1)}
            onValueChange={(value) =>
              updateConfig({ fiscalYearStartMonth: parseInt(value, 10) })
            }
          >
            <SelectTrigger id="fiscal-year-start" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                { value: '1', label: 'January' },
                { value: '2', label: 'February' },
                { value: '3', label: 'March' },
                { value: '4', label: 'April' },
                { value: '5', label: 'May' },
                { value: '6', label: 'June' },
                { value: '7', label: 'July' },
                { value: '8', label: 'August' },
                { value: '9', label: 'September' },
                { value: '10', label: 'October' },
                { value: '11', label: 'November' },
                { value: '12', label: 'December' },
              ].map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* As-of Date for MTD */}
      {config.type === 'mtd' && (
        <div>
          <Label htmlFor="as-of-date" className="text-sm font-medium">
            As of Date
          </Label>
          <Input
            id="as-of-date"
            type="date"
            value={config.asOfDate || new Date().toISOString().split('T')[0]}
            onChange={(e) => updateConfig({ asOfDate: e.target.value })}
            className="mt-1.5"
          />
        </div>
      )}

      {/* Date Range Summary */}
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              {dateRange.periodLabel}
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              {dateRange.startDate} to {dateRange.endDate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
