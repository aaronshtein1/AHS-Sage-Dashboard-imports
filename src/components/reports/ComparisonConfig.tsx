'use client';

import type { ReportComparisonConfig } from '@/types';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';

interface ComparisonConfigProps {
  config?: ReportComparisonConfig;
  onChange: (config: ReportComparisonConfig | undefined) => void;
}

const defaultConfig: ReportComparisonConfig = {
  enabled: false,
  type: 'prior-period',
  showVariance: true,
  showVariancePercent: true,
};

export function ComparisonConfig({ config, onChange }: ComparisonConfigProps) {
  const currentConfig = config || defaultConfig;

  const updateConfig = (updates: Partial<ReportComparisonConfig>) => {
    onChange({ ...currentConfig, ...updates });
  };

  const toggleEnabled = (enabled: boolean) => {
    if (enabled) {
      onChange({ ...defaultConfig, enabled: true });
    } else {
      onChange(undefined);
    }
  };

  return (
    <div className="space-y-6">
      {/* Enable Comparison */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="enable-comparison"
          checked={currentConfig.enabled}
          onCheckedChange={toggleEnabled}
          className="mt-0.5"
        />
        <div>
          <Label htmlFor="enable-comparison" className="cursor-pointer font-medium">
            Enable Comparison
          </Label>
          <p className="text-xs text-zinc-500 mt-0.5">
            Compare current period against prior period, prior year, or budget
          </p>
        </div>
      </div>

      {currentConfig.enabled && (
        <>
          {/* Comparison Type */}
          <div>
            <Label htmlFor="comparison-type" className="text-sm font-medium">
              Compare Against
            </Label>
            <Select
              value={currentConfig.type}
              onValueChange={(value: 'prior-period' | 'prior-year' | 'budget') =>
                updateConfig({ type: value })
              }
            >
              <SelectTrigger id="comparison-type" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prior-period">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4" />
                    <span>Prior Period</span>
                  </div>
                </SelectItem>
                <SelectItem value="prior-year">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Prior Year (Same Period)</span>
                  </div>
                </SelectItem>
                <SelectItem value="budget">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    <span>Budget</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Variance Display Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Variance Display</Label>

            <div className="flex items-start gap-3">
              <Checkbox
                id="show-variance"
                checked={currentConfig.showVariance}
                onCheckedChange={(checked) =>
                  updateConfig({ showVariance: !!checked })
                }
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="show-variance" className="cursor-pointer">
                  Show Variance Amount ($)
                </Label>
                <p className="text-xs text-zinc-500">
                  Display the dollar difference between periods
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="show-variance-pct"
                checked={currentConfig.showVariancePercent}
                onCheckedChange={(checked) =>
                  updateConfig({ showVariancePercent: !!checked })
                }
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="show-variance-pct" className="cursor-pointer">
                  Show Variance Percent (%)
                </Label>
                <p className="text-xs text-zinc-500">
                  Display the percentage change between periods
                </p>
              </div>
            </div>
          </div>

          {/* Comparison Info */}
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
            <p className="text-sm text-amber-800">
              {currentConfig.type === 'prior-period' && (
                <>
                  Compares against the immediately preceding period of the same length.
                </>
              )}
              {currentConfig.type === 'prior-year' && (
                <>
                  Compares against the same period one year ago.
                </>
              )}
              {currentConfig.type === 'budget' && (
                <>
                  Compares against the budgeted amounts for the selected period.
                </>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
