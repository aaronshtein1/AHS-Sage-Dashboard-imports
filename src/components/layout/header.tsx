"use client";

import { RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

interface HeaderProps {
  title: string;
  subtitle?: string;
  period?: string;
  onPeriodChange?: (period: string) => void;
  periods?: { value: string; label: string }[];
  showRefresh?: boolean;
  onRefresh?: () => void;
  showExport?: boolean;
  onExport?: () => void;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function Header({
  title,
  subtitle,
  period,
  onPeriodChange,
  periods,
  showRefresh = false,
  onRefresh,
  showExport = false,
  onExport,
  isLoading = false,
  children,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {periods && period && onPeriodChange && (
          <Select
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
            options={periods}
            className="w-40"
          />
        )}

        {children}

        {showRefresh && onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Sync
          </Button>
        )}

        {showExport && onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>
    </header>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
