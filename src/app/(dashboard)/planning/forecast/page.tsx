"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatPercent, getCurrentPeriod, getPeriodLabel, getPreviousPeriod } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { BarChart3, TrendingUp, Target, RefreshCw, Calendar, ArrowRight } from "lucide-react";

// Demo forecast data
const demoForecastData = [
  { month: "Jan", actual: 2450000, forecast: 2400000, budget: 2350000 },
  { month: "Feb", actual: 2520000, forecast: 2480000, budget: 2380000 },
  { month: "Mar", actual: 2680000, forecast: 2620000, budget: 2420000 },
  { month: "Apr", actual: 2590000, forecast: 2550000, budget: 2450000 },
  { month: "May", actual: 2750000, forecast: 2700000, budget: 2480000 },
  { month: "Jun", actual: 2847500, forecast: 2800000, budget: 2520000 },
  { month: "Jul", actual: null, forecast: 2880000, budget: 2550000 },
  { month: "Aug", actual: null, forecast: 2920000, budget: 2580000 },
  { month: "Sep", actual: null, forecast: 2980000, budget: 2620000 },
  { month: "Oct", actual: null, forecast: 3020000, budget: 2650000 },
  { month: "Nov", actual: null, forecast: 3080000, budget: 2680000 },
  { month: "Dec", actual: null, forecast: 3150000, budget: 2720000 },
];

// Forecast by category
const categoryForecasts = [
  {
    category: "Patient Revenue",
    ytdActual: 14250000,
    forecast: 32500000,
    budget: 29800000,
    priorYear: 28500000,
  },
  {
    category: "Lab Revenue",
    ytdActual: 1680000,
    forecast: 3850000,
    budget: 3500000,
    priorYear: 3200000,
  },
  {
    category: "Ancillary Services",
    ytdActual: 720000,
    forecast: 1650000,
    budget: 1400000,
    priorYear: 1250000,
  },
  {
    category: "Other Revenue",
    ytdActual: 187500,
    forecast: 420000,
    budget: 380000,
    priorYear: 350000,
  },
];

const expenseForecasts = [
  {
    category: "Labor Costs",
    ytdActual: 7850000,
    forecast: 17200000,
    budget: 16800000,
    priorYear: 15500000,
  },
  {
    category: "Medical Supplies",
    ytdActual: 2280000,
    forecast: 5100000,
    budget: 4800000,
    priorYear: 4400000,
  },
  {
    category: "Occupancy",
    ytdActual: 750000,
    forecast: 1500000,
    budget: 1500000,
    priorYear: 1450000,
  },
  {
    category: "Other Operating",
    ytdActual: 1420000,
    forecast: 3150000,
    budget: 2900000,
    priorYear: 2700000,
  },
];

export default function ForecastPage() {
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [activeTab, setActiveTab] = useState("revenue");

  const periods = Array.from({ length: 12 }, (_, i) => {
    const p = getPreviousPeriod(getCurrentPeriod(), i);
    return { value: p, label: getPeriodLabel(p) };
  });

  const ytdActualRevenue = demoForecastData.filter(d => d.actual).reduce((sum, d) => sum + (d.actual || 0), 0);
  const fullYearForecast = demoForecastData.reduce((sum, d) => sum + d.forecast, 0);
  const fullYearBudget = demoForecastData.reduce((sum, d) => sum + d.budget, 0);
  const forecastVariance = fullYearForecast - fullYearBudget;
  const forecastVariancePercent = (forecastVariance / fullYearBudget) * 100;

  const totalRevenueForecast = categoryForecasts.reduce((sum, c) => sum + c.forecast, 0);
  const totalExpenseForecast = expenseForecasts.reduce((sum, c) => sum + c.forecast, 0);
  const netIncomeForecast = totalRevenueForecast - totalExpenseForecast;

  const renderForecastTable = (data: typeof categoryForecasts, isExpense: boolean = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">YTD Actual</TableHead>
          <TableHead className="text-right">Full Year Forecast</TableHead>
          <TableHead className="text-right">Budget</TableHead>
          <TableHead className="text-right">Variance</TableHead>
          <TableHead className="text-right">Prior Year</TableHead>
          <TableHead className="text-right">YoY Growth</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => {
          const variance = row.forecast - row.budget;
          const yoyGrowth = ((row.forecast - row.priorYear) / row.priorYear) * 100;
          const variancePositive = isExpense ? variance <= 0 : variance >= 0;

          return (
            <TableRow key={row.category}>
              <TableCell className="font-medium">{row.category}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.ytdActual)}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(row.forecast)}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.budget)}</TableCell>
              <TableCell className="text-right">
                <span className={variancePositive ? "text-emerald-600" : "text-red-600"}>
                  {formatCurrency(variance, { showSign: true })}
                </span>
              </TableCell>
              <TableCell className="text-right">{formatCurrency(row.priorYear)}</TableCell>
              <TableCell className="text-right">
                <span className={yoyGrowth >= 0 ? (isExpense ? "text-red-600" : "text-emerald-600") : (isExpense ? "text-emerald-600" : "text-red-600")}>
                  {formatPercent(yoyGrowth, { showSign: true })}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-zinc-100 font-bold">
          <TableCell>Total</TableCell>
          <TableCell className="text-right">{formatCurrency(data.reduce((s, r) => s + r.ytdActual, 0))}</TableCell>
          <TableCell className="text-right">{formatCurrency(data.reduce((s, r) => s + r.forecast, 0))}</TableCell>
          <TableCell className="text-right">{formatCurrency(data.reduce((s, r) => s + r.budget, 0))}</TableCell>
          <TableCell className="text-right">
            {(() => {
              const totalVariance = data.reduce((s, r) => s + (r.forecast - r.budget), 0);
              const positive = isExpense ? totalVariance <= 0 : totalVariance >= 0;
              return (
                <span className={positive ? "text-emerald-600" : "text-red-600"}>
                  {formatCurrency(totalVariance, { showSign: true })}
                </span>
              );
            })()}
          </TableCell>
          <TableCell className="text-right">{formatCurrency(data.reduce((s, r) => s + r.priorYear, 0))}</TableCell>
          <TableCell className="text-right">
            {(() => {
              const totalForecast = data.reduce((s, r) => s + r.forecast, 0);
              const totalPrior = data.reduce((s, r) => s + r.priorYear, 0);
              const growth = ((totalForecast - totalPrior) / totalPrior) * 100;
              return (
                <span className={growth >= 0 ? (isExpense ? "text-red-600" : "text-emerald-600") : (isExpense ? "text-emerald-600" : "text-red-600")}>
                  {formatPercent(growth, { showSign: true })}
                </span>
              );
            })()}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );

  return (
    <div className="flex flex-col">
      <Header
        title="Financial Forecast"
        subtitle="Rolling forecast and projections"
        period={period}
        onPeriodChange={setPeriod}
        periods={periods}
        showExport
        onExport={() => console.log("Export")}
      />

      <div className="p-6">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <BarChart3 className="h-4 w-4" />
                YTD Revenue
              </div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(ytdActualRevenue)}</div>
              <div className="mt-1 text-sm text-zinc-500">
                {formatPercent((ytdActualRevenue / fullYearForecast) * 100)} of forecast
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Target className="h-4 w-4" />
                Full Year Forecast
              </div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(fullYearForecast)}</div>
              <div className={cn("mt-1 text-sm", forecastVariance >= 0 ? "text-emerald-600" : "text-red-600")}>
                {formatCurrency(forecastVariance, { showSign: true })} vs budget
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <TrendingUp className="h-4 w-4" />
                Net Income Forecast
              </div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(netIncomeForecast)}</div>
              <div className="mt-1 text-sm text-zinc-500">
                {formatPercent((netIncomeForecast / totalRevenueForecast) * 100)} margin
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Calendar className="h-4 w-4" />
                Last Updated
              </div>
              <div className="mt-1 text-2xl font-semibold">Today</div>
              <Button variant="outline" size="sm" className="mt-2">
                <RefreshCw className="mr-2 h-3 w-3" />
                Refresh Forecast
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Forecast Chart */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Revenue Forecast vs Actual</CardTitle>
            <Badge variant="secondary">
              <span className="mr-1 h-2 w-2 rounded-full bg-blue-500 inline-block" /> Actual
              <span className="mx-2">|</span>
              <span className="mr-1 h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Forecast
              <span className="mx-2">|</span>
              <span className="mr-1 h-2 w-2 rounded-full bg-zinc-400 inline-block" /> Budget
            </Badge>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={demoForecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                <Tooltip
                  formatter={(value) => typeof value === 'number' ? formatCurrency(value) : "N/A"}
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e4e4e7",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <ReferenceLine x="Jun" stroke="#94a3b8" strokeDasharray="5 5" label="Current" />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6" }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Forecast"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: "#10b981" }}
                />
                <Line
                  type="monotone"
                  dataKey="budget"
                  name="Budget"
                  stroke="#94a3b8"
                  strokeWidth={1}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Forecast Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Forecast by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="revenue">Revenue</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
              </TabsList>

              <TabsContent value="revenue">
                {renderForecastTable(categoryForecasts, false)}
              </TabsContent>

              <TabsContent value="expenses">
                {renderForecastTable(expenseForecasts, true)}
              </TabsContent>
            </Tabs>

            {/* Net Income Summary */}
            <div className="mt-6 rounded-lg bg-zinc-900 p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-zinc-400">Forecasted Net Income</div>
                  <div className="mt-1 text-3xl font-bold">{formatCurrency(netIncomeForecast)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-zinc-400">Net Margin</div>
                  <div className="mt-1 text-3xl font-bold text-emerald-400">
                    {formatPercent((netIncomeForecast / totalRevenueForecast) * 100)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
