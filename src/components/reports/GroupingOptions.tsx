'use client';

import type { CustomReportGrouping } from '@/types';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Layers } from 'lucide-react';

interface GroupingOptionsProps {
  grouping: CustomReportGrouping;
  onChange: (grouping: CustomReportGrouping) => void;
}

const GROUP_BY_OPTIONS = [
  { value: 'none', label: 'No Grouping', description: 'Show all accounts in a flat list' },
  { value: 'account-type', label: 'Account Type', description: 'Group by Asset, Liability, Equity, Revenue, Expense' },
  { value: 'category', label: 'Category', description: 'Group by account category (e.g., Current Assets, Operating Revenue)' },
] as const;

export function GroupingOptions({ grouping, onChange }: GroupingOptionsProps) {
  const updateGrouping = (updates: Partial<CustomReportGrouping>) => {
    onChange({ ...grouping, ...updates });
  };

  return (
    <div className="space-y-6">
      {/* Group By */}
      <div>
        <Label htmlFor="group-by" className="text-sm font-medium">
          Group By
        </Label>
        <Select
          value={grouping.groupBy}
          onValueChange={(value: 'none' | 'account-type' | 'category') =>
            updateGrouping({ groupBy: value })
          }
        >
          <SelectTrigger id="group-by" className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUP_BY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div>
                  <span>{opt.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-zinc-500 mt-1.5">
          {GROUP_BY_OPTIONS.find((o) => o.value === grouping.groupBy)?.description}
        </p>
      </div>

      {/* Totals Options */}
      <div className="space-y-3">
        <Label className="text-sm font-medium block">Totals</Label>

        <div className="flex items-start gap-3">
          <Checkbox
            id="show-subtotals"
            checked={grouping.showSubtotals}
            onCheckedChange={(checked) =>
              updateGrouping({ showSubtotals: !!checked })
            }
            disabled={grouping.groupBy === 'none'}
            className="mt-0.5"
          />
          <div>
            <Label
              htmlFor="show-subtotals"
              className={`cursor-pointer ${
                grouping.groupBy === 'none' ? 'text-zinc-400' : ''
              }`}
            >
              Show Subtotals
            </Label>
            <p className="text-xs text-zinc-500">
              Display a subtotal row for each group
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="show-grand-total"
            checked={grouping.showGrandTotal}
            onCheckedChange={(checked) =>
              updateGrouping({ showGrandTotal: !!checked })
            }
            className="mt-0.5"
          />
          <div>
            <Label htmlFor="show-grand-total" className="cursor-pointer">
              Show Grand Total
            </Label>
            <p className="text-xs text-zinc-500">
              Display a grand total row at the end of the report
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="collapse-default"
            checked={grouping.collapseByDefault || false}
            onCheckedChange={(checked) =>
              updateGrouping({ collapseByDefault: !!checked })
            }
            disabled={grouping.groupBy === 'none'}
            className="mt-0.5"
          />
          <div>
            <Label
              htmlFor="collapse-default"
              className={`cursor-pointer ${
                grouping.groupBy === 'none' ? 'text-zinc-400' : ''
              }`}
            >
              Collapse Groups by Default
            </Label>
            <p className="text-xs text-zinc-500">
              Start with groups collapsed, showing only subtotals
            </p>
          </div>
        </div>
      </div>

      {/* Preview */}
      {grouping.groupBy !== 'none' && (
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Layers className="h-4 w-4 text-zinc-600 mt-0.5" />
            <div className="text-sm text-zinc-700">
              <p className="font-medium">Report Structure:</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                <li>
                  1. Accounts grouped by{' '}
                  {grouping.groupBy === 'account-type'
                    ? 'type'
                    : 'category'}
                </li>
                {grouping.showSubtotals && <li>2. Subtotal after each group</li>}
                {grouping.showGrandTotal && <li>3. Grand total at the end</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
