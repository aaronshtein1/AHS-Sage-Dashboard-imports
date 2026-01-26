"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { VarianceChart } from "@/components/charts/variance-chart";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatPercent, getCurrentPeriod, getPeriodLabel } from "@/lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown, Building2 } from "lucide-react";

// Demo data - this will be replaced with real Intacct data
const demoKPIs = {
  revenue: 2847500,
  revenueChange: 8.4,
  netIncome: 485200,
  netIncomeChange: 12.1,
  grossMargin: 42.5,
  grossMarginChange: 1.2,
  cashPosition: 1250000,
  cashChange: -3.2,
};

const demoTrendData = [
  { period: "2025-07", revenue: 2450000, expenses: 2050000, netIncome: 400000 },
  { period: "2025-08", revenue: 2520000, expenses: 2100000, netIncome: 420000 },
  { period: "2025-09", revenue: 2680000, expenses: 2180000, netIncome: 500000 },
  { period: "2025-10", revenue: 2590000, expenses: 2150000, netIncome: 440000 },
  { period: "2025-11", revenue: 2750000, expenses: 2220000, netIncome: 530000 },
  { period: "2025-12", revenue: 2847500, expenses: 2362300, netIncome: 485200 },
];

const demoVariances = [
  { category: "Patient Revenue", variance: 125000, isPositive: true },
  { category: "Supplies", variance: -45000, isPositive: false },
  { category: "Labor Costs", variance: -82000, isPositive: false },
  { category: "Other Revenue", variance: 35000, isPositive: true },
  { category: "Rent & Utilities", variance: 12000, isPositive: true },
];

const demoLocationPerformance = [
  { location: "Downtown Clinic", revenue: 980000, margin: 38.5, trend: "up" as const },
  { location: "Westside Office", revenue: 720000, margin: 35.2, trend: "up" as const },
  { location: "North Campus", revenue: 545000, margin: 28.4, trend: "down" as const },
  { location: "East Medical", revenue: 602500, margin: 32.1, trend: "flat" as const },
];

const demoAlerts: Array<{
  id: string;
  type: "warning" | "error" | "info";
  title: string;
  description: string;
  category: string;
}> = [
  {
    id: "1",
    type: "warning",
    title: "Labor costs over budget",
    description: "Clinical staff overtime 15% above forecast",
    category: "Workforce",
  },
  {
    id: "2",
    type: "warning",
    title: "North Campus margin declining",
    description: "Gross margin down 4.2% vs prior quarter",
    category: "Location",
  },
  {
    id: "3",
    type: "info",
    title: "Medicare reimbursement change",
    description: "New rates effective next month",
    category: "Payer",
  },
];

export default function DashboardPage() {
  const [period, setPeriod] = useState(getCurrentPeriod());

  return (
    <div className="flex flex-col">
      <Header
        title="Financial Overview"
        subtitle={`Period: ${getPeriodLabel(period)}`}
        showRefresh
        onRefresh={() => console.log("Refresh")}
      />

      <div className="p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Revenue"
            value={demoKPIs.revenue}
            change={demoKPIs.revenueChange}
            changeLabel="vs prior period"
            trend="up"
            trendDirection="positive"
          />
          <KPICard
            title="Net Income"
            value={demoKPIs.netIncome}
            change={demoKPIs.netIncomeChange}
            changeLabel="vs prior period"
            trend="up"
            trendDirection="positive"
          />
          <KPICard
            title="Gross Margin"
            value={demoKPIs.grossMargin}
            format="percent"
            change={demoKPIs.grossMarginChange}
            changeLabel="vs prior period"
            trend="up"
            trendDirection="positive"
          />
          <KPICard
            title="Cash Position"
            value={demoKPIs.cashPosition}
            change={demoKPIs.cashChange}
            changeLabel="vs prior period"
            trend="down"
            trendDirection="negative"
          />
        </div>

        {/* Charts Row */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Revenue Trend */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Revenue & Net Income Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueChart data={demoTrendData} showExpenses height={280} />
            </CardContent>
          </Card>

          {/* Budget Variance */}
          <Card>
            <CardHeader>
              <CardTitle>Budget Variance</CardTitle>
            </CardHeader>
            <CardContent>
              <VarianceChart data={demoVariances} height={280} />
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Location Performance */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Location Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoLocationPerformance.map((loc) => (
                    <TableRow key={loc.location}>
                      <TableCell className="font-medium">{loc.location}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(loc.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(loc.margin)}
                      </TableCell>
                      <TableCell className="text-right">
                        {loc.trend === "up" ? (
                          <TrendingUp className="inline h-4 w-4 text-emerald-500" />
                        ) : loc.trend === "down" ? (
                          <TrendingDown className="inline h-4 w-4 text-red-500" />
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Alerts & Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {demoAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3"
                  >
                    <div
                      className={`mt-0.5 h-2 w-2 rounded-full ${
                        alert.type === "warning"
                          ? "bg-amber-500"
                          : alert.type === "error"
                          ? "bg-red-500"
                          : "bg-blue-500"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{alert.title}</span>
                        <Badge variant="secondary" className="text-xs">
                          {alert.category}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">{alert.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
