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
import { formatCurrency, formatPercent, getCurrentPeriod, getPeriodLabel, getPreviousPeriod } from "@/lib/utils";
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
} from "recharts";
import { Users, DollarSign, TrendingUp, TrendingDown, Plus, Calculator } from "lucide-react";

// Demo headcount data
const demoHeadcountData = {
  clinical: [
    {
      id: "pos1",
      title: "Physicians",
      budgetedFTE: 12.0,
      actualFTE: 11.5,
      avgSalary: 285000,
      benefitsPercent: 18,
      payrollTaxPercent: 8,
    },
    {
      id: "pos2",
      title: "Nurse Practitioners",
      budgetedFTE: 8.0,
      actualFTE: 8.0,
      avgSalary: 125000,
      benefitsPercent: 18,
      payrollTaxPercent: 8,
    },
    {
      id: "pos3",
      title: "Registered Nurses",
      budgetedFTE: 18.0,
      actualFTE: 17.0,
      avgSalary: 85000,
      benefitsPercent: 18,
      payrollTaxPercent: 8,
    },
    {
      id: "pos4",
      title: "Medical Assistants",
      budgetedFTE: 24.0,
      actualFTE: 26.0,
      avgSalary: 42000,
      benefitsPercent: 18,
      payrollTaxPercent: 8,
    },
    {
      id: "pos5",
      title: "Lab Technicians",
      budgetedFTE: 6.0,
      actualFTE: 6.0,
      avgSalary: 55000,
      benefitsPercent: 18,
      payrollTaxPercent: 8,
    },
  ],
  administrative: [
    {
      id: "pos6",
      title: "Front Desk / Reception",
      budgetedFTE: 8.0,
      actualFTE: 9.0,
      avgSalary: 38000,
      benefitsPercent: 18,
      payrollTaxPercent: 8,
    },
    {
      id: "pos7",
      title: "Billing / Coding",
      budgetedFTE: 6.0,
      actualFTE: 6.0,
      avgSalary: 52000,
      benefitsPercent: 18,
      payrollTaxPercent: 8,
    },
    {
      id: "pos8",
      title: "Office Managers",
      budgetedFTE: 3.0,
      actualFTE: 3.0,
      avgSalary: 72000,
      benefitsPercent: 18,
      payrollTaxPercent: 8,
    },
    {
      id: "pos9",
      title: "Administrative Staff",
      budgetedFTE: 4.0,
      actualFTE: 5.0,
      avgSalary: 45000,
      benefitsPercent: 18,
      payrollTaxPercent: 8,
    },
    {
      id: "pos10",
      title: "IT Support",
      budgetedFTE: 2.0,
      actualFTE: 2.0,
      avgSalary: 68000,
      benefitsPercent: 18,
      payrollTaxPercent: 8,
    },
  ],
};

const calculateFullyLoadedCost = (
  fte: number,
  salary: number,
  benefitsPercent: number,
  payrollTaxPercent: number
) => {
  const baseCost = fte * salary;
  const benefits = baseCost * (benefitsPercent / 100);
  const payrollTax = baseCost * (payrollTaxPercent / 100);
  return {
    baseCost,
    benefits,
    payrollTax,
    totalCost: baseCost + benefits + payrollTax,
  };
};

export default function HeadcountPage() {
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [activeTab, setActiveTab] = useState("clinical");

  const periods = Array.from({ length: 12 }, (_, i) => {
    const p = getPreviousPeriod(getCurrentPeriod(), i);
    return { value: p, label: getPeriodLabel(p) };
  });

  // Calculate totals for each category
  const calculateCategoryTotals = (positions: typeof demoHeadcountData.clinical) => {
    return positions.reduce(
      (acc, pos) => {
        const budgetCosts = calculateFullyLoadedCost(
          pos.budgetedFTE,
          pos.avgSalary,
          pos.benefitsPercent,
          pos.payrollTaxPercent
        );
        const actualCosts = calculateFullyLoadedCost(
          pos.actualFTE,
          pos.avgSalary,
          pos.benefitsPercent,
          pos.payrollTaxPercent
        );

        return {
          budgetedFTE: acc.budgetedFTE + pos.budgetedFTE,
          actualFTE: acc.actualFTE + pos.actualFTE,
          budgetedCost: acc.budgetedCost + budgetCosts.totalCost,
          actualCost: acc.actualCost + actualCosts.totalCost,
        };
      },
      { budgetedFTE: 0, actualFTE: 0, budgetedCost: 0, actualCost: 0 }
    );
  };

  const clinicalTotals = calculateCategoryTotals(demoHeadcountData.clinical);
  const adminTotals = calculateCategoryTotals(demoHeadcountData.administrative);

  const grandTotals = {
    budgetedFTE: clinicalTotals.budgetedFTE + adminTotals.budgetedFTE,
    actualFTE: clinicalTotals.actualFTE + adminTotals.actualFTE,
    budgetedCost: clinicalTotals.budgetedCost + adminTotals.budgetedCost,
    actualCost: clinicalTotals.actualCost + adminTotals.actualCost,
  };

  // Chart data
  const chartData = [
    {
      category: "Clinical",
      budgeted: clinicalTotals.budgetedFTE,
      actual: clinicalTotals.actualFTE,
    },
    {
      category: "Admin",
      budgeted: adminTotals.budgetedFTE,
      actual: adminTotals.actualFTE,
    },
  ];

  const costChartData = [
    {
      category: "Clinical",
      budgeted: clinicalTotals.budgetedCost,
      actual: clinicalTotals.actualCost,
    },
    {
      category: "Admin",
      budgeted: adminTotals.budgetedCost,
      actual: adminTotals.actualCost,
    },
  ];

  const renderPositionTable = (positions: typeof demoHeadcountData.clinical) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Position</TableHead>
          <TableHead className="text-right">Budget FTE</TableHead>
          <TableHead className="text-right">Actual FTE</TableHead>
          <TableHead className="text-right">Variance</TableHead>
          <TableHead className="text-right">Avg Salary</TableHead>
          <TableHead className="text-right">Budget Cost</TableHead>
          <TableHead className="text-right">Actual Cost</TableHead>
          <TableHead className="text-right">Cost Variance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {positions.map((pos) => {
          const budgetCosts = calculateFullyLoadedCost(
            pos.budgetedFTE,
            pos.avgSalary,
            pos.benefitsPercent,
            pos.payrollTaxPercent
          );
          const actualCosts = calculateFullyLoadedCost(
            pos.actualFTE,
            pos.avgSalary,
            pos.benefitsPercent,
            pos.payrollTaxPercent
          );
          const fteVariance = pos.actualFTE - pos.budgetedFTE;
          const costVariance = actualCosts.totalCost - budgetCosts.totalCost;

          return (
            <TableRow key={pos.id}>
              <TableCell className="font-medium">{pos.title}</TableCell>
              <TableCell className="text-right">{pos.budgetedFTE.toFixed(1)}</TableCell>
              <TableCell className="text-right">{pos.actualFTE.toFixed(1)}</TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    "font-medium",
                    fteVariance > 0 ? "text-red-600" : fteVariance < 0 ? "text-emerald-600" : ""
                  )}
                >
                  {fteVariance > 0 ? "+" : ""}
                  {fteVariance.toFixed(1)}
                </span>
              </TableCell>
              <TableCell className="text-right">{formatCurrency(pos.avgSalary)}</TableCell>
              <TableCell className="text-right">{formatCurrency(budgetCosts.totalCost)}</TableCell>
              <TableCell className="text-right">{formatCurrency(actualCosts.totalCost)}</TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    "font-medium",
                    costVariance > 0 ? "text-red-600" : costVariance < 0 ? "text-emerald-600" : ""
                  )}
                >
                  {formatCurrency(costVariance, { showSign: true })}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <div className="flex flex-col">
      <Header
        title="Headcount Planning"
        subtitle={`Period: ${getPeriodLabel(period)}`}
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
                <Users className="h-4 w-4" />
                Total Headcount (FTE)
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{grandTotals.actualFTE.toFixed(1)}</span>
                <span className="text-sm text-zinc-500">/ {grandTotals.budgetedFTE.toFixed(1)} budgeted</span>
              </div>
              <div
                className={cn(
                  "mt-1 text-sm font-medium",
                  grandTotals.actualFTE > grandTotals.budgetedFTE ? "text-red-600" : "text-emerald-600"
                )}
              >
                {grandTotals.actualFTE > grandTotals.budgetedFTE ? "+" : ""}
                {(grandTotals.actualFTE - grandTotals.budgetedFTE).toFixed(1)} FTE
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <DollarSign className="h-4 w-4" />
                Total Labor Cost
              </div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(grandTotals.actualCost)}</div>
              <div
                className={cn(
                  "mt-1 text-sm font-medium",
                  grandTotals.actualCost > grandTotals.budgetedCost ? "text-red-600" : "text-emerald-600"
                )}
              >
                {formatCurrency(grandTotals.actualCost - grandTotals.budgetedCost, { showSign: true })} vs budget
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Clinical Staff</div>
              <div className="mt-1 text-2xl font-semibold">{clinicalTotals.actualFTE.toFixed(1)} FTE</div>
              <div className="mt-1 text-sm text-zinc-500">{formatCurrency(clinicalTotals.actualCost)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Administrative Staff</div>
              <div className="mt-1 text-2xl font-semibold">{adminTotals.actualFTE.toFixed(1)} FTE</div>
              <div className="mt-1 text-sm text-zinc-500">{formatCurrency(adminTotals.actualCost)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Headcount: Budget vs Actual</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e4e4e7",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="budgeted" name="Budgeted FTE" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="Actual FTE" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Labor Cost: Budget vs Actual</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={costChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), ""]}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e4e4e7",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="budgeted" name="Budgeted Cost" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="Actual Cost" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Position Details */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Position Details
            </CardTitle>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Position
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="clinical">
                  Clinical Staff ({clinicalTotals.actualFTE.toFixed(1)} FTE)
                </TabsTrigger>
                <TabsTrigger value="administrative">
                  Administrative ({adminTotals.actualFTE.toFixed(1)} FTE)
                </TabsTrigger>
              </TabsList>

              <TabsContent value="clinical">
                {renderPositionTable(demoHeadcountData.clinical)}
              </TabsContent>

              <TabsContent value="administrative">
                {renderPositionTable(demoHeadcountData.administrative)}
              </TabsContent>
            </Tabs>

            {/* Cost Breakdown Note */}
            <div className="mt-4 rounded-lg bg-zinc-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calculator className="h-4 w-4" />
                Fully-Loaded Cost Calculation
              </div>
              <div className="mt-2 text-sm text-zinc-500">
                Total Cost = Base Salary + Benefits (18%) + Payroll Taxes (8%) = 126% of Base Salary
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
