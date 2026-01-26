"use client";

import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: number;
  format?: "currency" | "percent" | "number";
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "flat";
  trendDirection?: "positive" | "negative" | "neutral";
  compact?: boolean;
  className?: string;
}

export function KPICard({
  title,
  value,
  format = "currency",
  change,
  changeLabel,
  trend,
  trendDirection = "neutral",
  compact = false,
  className,
}: KPICardProps) {
  const formattedValue =
    format === "currency"
      ? formatCurrency(value, { compact })
      : format === "percent"
      ? formatPercent(value)
      : value.toLocaleString();

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const trendColor =
    trendDirection === "positive"
      ? "text-emerald-600"
      : trendDirection === "negative"
      ? "text-red-600"
      : "text-zinc-500";

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div className="text-sm font-medium text-zinc-500">{title}</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-zinc-900">
            {formattedValue}
          </span>
        </div>
        {(change !== undefined || changeLabel) && (
          <div className={cn("mt-2 flex items-center gap-1 text-sm", trendColor)}>
            {trend && <TrendIcon className="h-4 w-4" />}
            {change !== undefined && (
              <span className="font-medium">{formatPercent(change, { showSign: true })}</span>
            )}
            {changeLabel && <span className="text-zinc-500">{changeLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
