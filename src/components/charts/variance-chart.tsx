"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface VarianceChartProps {
  data: Array<{
    category: string;
    variance: number;
    isPositive?: boolean;
  }>;
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
}

export function VarianceChart({
  data,
  height = 300,
  positiveColor = "#10b981",
  negativeColor = "#ef4444",
}: VarianceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 10, left: 100, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 12, fill: "#71717a" }}
          tickLine={false}
          axisLine={{ stroke: "#e4e4e7" }}
          tickFormatter={(value) => formatCurrency(value, { compact: true })}
        />
        <YAxis
          type="category"
          dataKey="category"
          tick={{ fontSize: 12, fill: "#71717a" }}
          tickLine={false}
          axisLine={{ stroke: "#e4e4e7" }}
          width={90}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e4e4e7",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number) => [formatCurrency(value, { showSign: true }), "Variance"]}
        />
        <ReferenceLine x={0} stroke="#71717a" />
        <Bar dataKey="variance" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.isPositive !== undefined
                  ? entry.isPositive
                    ? positiveColor
                    : negativeColor
                  : entry.variance >= 0
                  ? positiveColor
                  : negativeColor
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
