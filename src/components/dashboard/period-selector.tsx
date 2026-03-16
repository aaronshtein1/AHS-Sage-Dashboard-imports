"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getPeriodLabel, getCurrentPeriod, getPreviousPeriod } from "@/lib/utils";

interface PeriodSelectorProps {
  value: string;
  onChange: (period: string) => void;
  comparisonValue?: string;
  onComparisonChange?: (period: string) => void;
  showComparison?: boolean;
  fiscalYearStart?: number;
}

export function PeriodSelector({
  value,
  onChange,
  comparisonValue,
  onComparisonChange,
  showComparison = false,
  fiscalYearStart = 1,
}: PeriodSelectorProps) {
  // Generate last 24 months
  const periods = Array.from({ length: 24 }, (_, i) => {
    const period = getPreviousPeriod(getCurrentPeriod(), i);
    return {
      value: period,
      label: getPeriodLabel(period),
    };
  });

  const comparisonOptions = [
    { value: "prior-period", label: "vs Prior Period" },
    { value: "prior-year", label: "vs Prior Year" },
    { value: "budget", label: "vs Budget" },
  ];

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          {periods.map((period) => (
            <SelectItem key={period.value} value={period.value}>
              {period.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showComparison && onComparisonChange && (
        <>
          <span className="text-sm text-zinc-500">compare</span>
          <Select value={comparisonValue || "prior-period"} onValueChange={onComparisonChange}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Select comparison" />
            </SelectTrigger>
            <SelectContent>
              {comparisonOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      <div className="ml-2 flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(getCurrentPeriod())}
        >
          Current
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Set to YTD (fiscal year start to current)
            onChange(getCurrentPeriod());
          }}
        >
          YTD
        </Button>
      </div>
    </div>
  );
}
