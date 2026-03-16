'use client';

import type { CustomReportAccountFilters } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter } from 'lucide-react';

interface AccountFiltersProps {
  filters: CustomReportAccountFilters;
  onChange: (filters: CustomReportAccountFilters) => void;
}

const ACCOUNT_TYPES = [
  { value: 'ASSET', label: 'Assets' },
  { value: 'LIABILITY', label: 'Liabilities' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'REVENUE', label: 'Revenue' },
  { value: 'EXPENSE', label: 'Expenses' },
] as const;

export function AccountFilters({ filters, onChange }: AccountFiltersProps) {
  const updateFilters = (updates: Partial<CustomReportAccountFilters>) => {
    onChange({ ...filters, ...updates });
  };

  const toggleAccountType = (type: (typeof ACCOUNT_TYPES)[number]['value']) => {
    const current = filters.accountTypes || [];
    if (current.includes(type)) {
      updateFilters({
        accountTypes: current.filter((t) => t !== type),
      });
    } else {
      updateFilters({
        accountTypes: [...current, type],
      });
    }
  };

  const allTypesSelected =
    !filters.accountTypes || filters.accountTypes.length === 0;

  return (
    <div className="space-y-6">
      {/* Account Types */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Account Types</Label>
        <p className="text-xs text-zinc-500 mb-3">
          Select which account types to include. Leave all unchecked to include all.
        </p>

        <div className="flex flex-wrap gap-2">
          {ACCOUNT_TYPES.map((type) => {
            const isSelected =
              allTypesSelected || filters.accountTypes?.includes(type.value);
            return (
              <button
                key={type.value}
                onClick={() => toggleAccountType(type.value)}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  isSelected
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Account Code Range */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Account Code Range</Label>
        <div className="flex items-center gap-2">
          <Input
            placeholder="From (e.g., 1000)"
            value={filters.accountCodeStart || ''}
            onChange={(e) => updateFilters({ accountCodeStart: e.target.value })}
            className="flex-1"
          />
          <span className="text-zinc-400">to</span>
          <Input
            placeholder="To (e.g., 9999)"
            value={filters.accountCodeEnd || ''}
            onChange={(e) => updateFilters({ accountCodeEnd: e.target.value })}
            className="flex-1"
          />
        </div>
        <p className="text-xs text-zinc-500 mt-1.5">
          Leave blank to include all account codes
        </p>
      </div>

      {/* Include Options */}
      <div className="space-y-3">
        <Label className="text-sm font-medium block">Include Options</Label>

        <div className="flex items-start gap-3">
          <Checkbox
            id="include-zero"
            checked={filters.includeZeroBalances}
            onCheckedChange={(checked) =>
              updateFilters({ includeZeroBalances: !!checked })
            }
            className="mt-0.5"
          />
          <div>
            <Label htmlFor="include-zero" className="cursor-pointer">
              Include Zero Balances
            </Label>
            <p className="text-xs text-zinc-500">
              Show accounts with no activity or zero balance
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="include-inactive"
            checked={filters.includeInactiveAccounts}
            onCheckedChange={(checked) =>
              updateFilters({ includeInactiveAccounts: !!checked })
            }
            className="mt-0.5"
          />
          <div>
            <Label htmlFor="include-inactive" className="cursor-pointer">
              Include Inactive Accounts
            </Label>
            <p className="text-xs text-zinc-500">
              Show accounts that have been marked as inactive
            </p>
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      {(filters.accountTypes?.length ||
        filters.accountCodeStart ||
        filters.accountCodeEnd) && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-start gap-2">
            <Filter className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Active Filters:</p>
              <ul className="mt-1 space-y-0.5">
                {(filters.accountTypes?.length ?? 0) > 0 && (
                  <li>
                    Types: {filters.accountTypes?.join(', ')}
                  </li>
                )}
                {(filters.accountCodeStart || filters.accountCodeEnd) && (
                  <li>
                    Code range: {filters.accountCodeStart || '*'} -{' '}
                    {filters.accountCodeEnd || '*'}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
