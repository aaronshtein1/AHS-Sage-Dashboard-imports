"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Target, TrendingUp, TrendingDown, AlertTriangle, Check, Edit2 } from "lucide-react";

// Demo budget data
const demoBudgetSummary = {
  id: "budget-2025",
  name: "Operating Budget 2025",
  fiscalYear: 2025,
  status: "active",
  totalRevenue: 32500000,
  totalExpenses: 27800000,
  netIncome: 4700000,
  totalHeadcount: 91,
  totalLaborCost: 9250000,
};

const demoMonthlyBudget = [
  { month: "Jan", revenue: 2650000, expenses: 2280000, netIncome: 370000 },
  { month: "Feb", revenue: 2580000, expenses: 2220000, netIncome: 360000 },
  { month: "Mar", revenue: 2720000, expenses: 2340000, netIncome: 380000 },
  { month: "Apr", revenue: 2680000, expenses: 2300000, netIncome: 380000 },
  { month: "May", revenue: 2750000, expenses: 2360000, netIncome: 390000 },
  { month: "Jun", revenue: 2700000, expenses: 2320000, netIncome: 380000 },
  { month: "Jul", revenue: 2620000, expenses: 2260000, netIncome: 360000 },
  { month: "Aug", revenue: 2680000, expenses: 2300000, netIncome: 380000 },
  { month: "Sep", revenue: 2780000, expenses: 2380000, netIncome: 400000 },
  { month: "Oct", revenue: 2820000, expenses: 2420000, netIncome: 400000 },
  { month: "Nov", revenue: 2750000, expenses: 2360000, netIncome: 390000 },
  { month: "Dec", revenue: 2770000, expenses: 2360000, netIncome: 410000 },
];

const demoBudgetVsActual = [
  { category: "Patient Revenue", budget: 28500000, actual: 27800000, variance: -700000 },
  { category: "Lab Revenue", budget: 2800000, actual: 2950000, variance: 150000 },
  { category: "Other Revenue", budget: 1200000, actual: 1150000, variance: -50000 },
  { category: "Medical Supplies", budget: 4200000, actual: 4450000, variance: -250000 },
  { category: "Clinical Labor", budget: 7500000, actual: 7850000, variance: -350000 },
  { category: "Admin Labor", budget: 1750000, actual: 1680000, variance: 70000 },
  { category: "Rent & Facilities", budget: 1500000, actual: 1480000, variance: 20000 },
  { category: "Other OpEx", budget: 2850000, actual: 2920000, variance: -70000 },
];

const demoVarianceAlerts = [
  { category: "Clinical Labor", variance: -350000, percentVar: -4.7, severity: "high" },
  { category: "Medical Supplies", variance: -250000, percentVar: -6.0, severity: "high" },
  { category: "Patient Revenue", variance: -700000, percentVar: -2.5, severity: "medium" },
];

export default function BudgetPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="flex flex-col">
      <Header
        title="Budget Management"
        subtitle={`${demoBudgetSummary.name} - FY${demoBudgetSummary.fiscalYear}`}
        showExport
        onExport={() => console.log("Export")}
      >
        <Badge
          variant={demoBudgetSummary.status === "active" ? "success" : "secondary"}
          className="ml-2"
        >
          {demoBudgetSummary.status}
        </Badge>
      </Header>

      <div className="p-6">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Budgeted Revenue</div>
              <div className="mt-1 text-2xl font-semibold">
                {formatCurrency(demoBudgetSummary.totalRevenue)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Budgeted Expenses</div>
              <div className="mt-1 text-2xl font-semibold">
                {formatCurrency(demoBudgetSummary.totalExpenses)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Budgeted Net Income</div>
              <div className="mt-1 text-2xl font-semibold">
                {formatCurrency(demoBudgetSummary.netIncome)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Target Headcount</div>
              <div className="mt-1 text-2xl font-semibold">{demoBudgetSummary.totalHeadcount} FTE</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Labor Budget</div>
              <div className="mt-1 text-2xl font-semibold">
                {formatCurrency(demoBudgetSummary.totalLaborCost)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="variance">Variance Analysis</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Detail</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Monthly Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Budget Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={demoMonthlyBudget}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), ""]}
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e4e4e7",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Net Income Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Net Income Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={demoMonthlyBudget}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), "Net Income"]}
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e4e4e7",
                          borderRadius: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="netIncome"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: "#3b82f6" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="variance">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Variance Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Variance Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {demoVarianceAlerts.map((alert, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-lg border p-3",
                          alert.severity === "high" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                        )}
                      >
                        <div className="font-medium">{alert.category}</div>
                        <div className="mt-1 flex justify-between text-sm">
                          <span className={alert.variance < 0 ? "text-red-600" : "text-emerald-600"}>
                            {formatCurrency(alert.variance, { showSign: true })}
                          </span>
                          <span className={alert.variance < 0 ? "text-red-600" : "text-emerald-600"}>
                            {formatPercent(alert.percentVar, { showSign: true })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Full Variance Table */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Budget vs Actual (YTD)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {demoBudgetVsActual.map((item, idx) => {
                        const isRevenue = item.category.includes("Revenue");
                        const isPositive = isRevenue ? item.variance >= 0 : item.variance <= 0;
                        const percentVar = (item.variance / item.budget) * 100;

                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.category}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.budget)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.actual)}</TableCell>
                            <TableCell className="text-right">
                              <span className={cn("font-medium", isPositive ? "text-emerald-600" : "text-red-600")}>
                                {formatCurrency(item.variance, { showSign: true })}
                              </span>
                              <span className="ml-2 text-sm text-zinc-500">
                                ({formatPercent(percentVar, { showSign: true })})
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {isPositive ? (
                                <Check className="inline h-4 w-4 text-emerald-500" />
                              ) : (
                                <AlertTriangle className="inline h-4 w-4 text-red-500" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="monthly">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Monthly Budget Detail</CardTitle>
                <Button variant="outline" size="sm">
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit Budget
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                      <TableHead className="text-right">Net Income</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demoMonthlyBudget.map((month) => {
                      const margin = (month.netIncome / month.revenue) * 100;
                      return (
                        <TableRow key={month.month}>
                          <TableCell className="font-medium">{month.month}</TableCell>
                          <TableCell className="text-right">{formatCurrency(month.revenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(month.expenses)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(month.netIncome)}
                          </TableCell>
                          <TableCell className="text-right">{formatPercent(margin)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-t-2 bg-zinc-100 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(demoMonthlyBudget.reduce((s, m) => s + m.revenue, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(demoMonthlyBudget.reduce((s, m) => s + m.expenses, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(demoMonthlyBudget.reduce((s, m) => s + m.netIncome, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(
                          (demoMonthlyBudget.reduce((s, m) => s + m.netIncome, 0) /
                            demoMonthlyBudget.reduce((s, m) => s + m.revenue, 0)) *
                            100
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
