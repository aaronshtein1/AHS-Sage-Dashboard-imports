"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency, getPeriodLabel } from "@/lib/utils";

interface RevenueChartProps {
  data: Array<{
    period: string;
    revenue: number;
    expenses?: number;
    netIncome?: number;
  }>;
  showExpenses?: boolean;
  showNetIncome?: boolean;
  height?: number;
}

export function RevenueChart({
  data,
  showExpenses = false,
  showNetIncome = true,
  height = 300,
}: RevenueChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    periodLabel: getPeriodLabel(item.period),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorNetIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis
          dataKey="periodLabel"
          tick={{ fontSize: 12, fill: "#71717a" }}
          tickLine={false}
          axisLine={{ stroke: "#e4e4e7" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#71717a" }}
          tickLine={false}
          axisLine={{ stroke: "#e4e4e7" }}
          tickFormatter={(value) => formatCurrency(value, { compact: true })}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e4e4e7",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number) => [formatCurrency(value), ""]}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#colorRevenue)"
        />
        {showExpenses && (
          <Area
            type="monotone"
            dataKey="expenses"
            name="Expenses"
            stroke="#ef4444"
            strokeWidth={2}
            fill="url(#colorExpenses)"
          />
        )}
        {showNetIncome && (
          <Area
            type="monotone"
            dataKey="netIncome"
            name="Net Income"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#colorNetIncome)"
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
