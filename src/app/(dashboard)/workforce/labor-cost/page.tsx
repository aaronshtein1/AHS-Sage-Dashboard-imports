"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { DollarSign, Users, Clock, TrendingUp, TrendingDown, AlertTriangle, Percent } from "lucide-react";

// Demo labor cost data
const laborCostTrend = [
  { month: "Jul", salaries: 680000, benefits: 122400, payrollTax: 54400, overtime: 28000 },
  { month: "Aug", salaries: 695000, benefits: 125100, payrollTax: 55600, overtime: 32000 },
  { month: "Sep", salaries: 702000, benefits: 126360, payrollTax: 56160, overtime: 45000 },
  { month: "Oct", salaries: 710000, benefits: 127800, payrollTax: 56800, overtime: 38000 },
  { month: "Nov", salaries: 725000, benefits: 130500, payrollTax: 58000, overtime: 52000 },
  { month: "Dec", salaries: 738000, benefits: 132840, payrollTax: 59040, overtime: 48000 },
];

// Labor cost by department
const laborByDepartment = [
  {
    department: "Clinical - Physicians",
    fte: 11.5,
    baseSalary: 3277500,
    benefits: 589950,
    payrollTax: 262200,
    overtime: 45000,
    budgeted: 4200000,
  },
  {
    department: "Clinical - Nursing",
    fte: 25.0,
    baseSalary: 2125000,
    benefits: 382500,
    payrollTax: 170000,
    overtime: 125000,
    budgeted: 2700000,
  },
  {
    department: "Clinical - Support",
    fte: 30.0,
    baseSalary: 1410000,
    benefits: 253800,
    payrollTax: 112800,
    overtime: 65000,
    budgeted: 1750000,
  },
  {
    department: "Administrative",
    fte: 15.0,
    baseSalary: 780000,
    benefits: 140400,
    payrollTax: 62400,
    overtime: 18000,
    budgeted: 950000,
  },
  {
    department: "Billing & Revenue Cycle",
    fte: 6.0,
    baseSalary: 312000,
    benefits: 56160,
    payrollTax: 24960,
    overtime: 8000,
    budgeted: 400000,
  },
  {
    department: "Management",
    fte: 4.5,
    baseSalary: 585000,
    benefits: 105300,
    payrollTax: 46800,
    overtime: 0,
    budgeted: 720000,
  },
];

// Cost composition for pie chart
const costComposition = [
  { name: "Base Salaries", value: 8489500, color: "#3b82f6" },
  { name: "Benefits", value: 1528110, color: "#10b981" },
  { name: "Payroll Taxes", value: 679160, color: "#f59e0b" },
  { name: "Overtime", value: 261000, color: "#ef4444" },
];

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

export default function LaborCostPage() {
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [activeTab, setActiveTab] = useState("summary");

  const periods = Array.from({ length: 12 }, (_, i) => {
    const p = getPreviousPeriod(getCurrentPeriod(), i);
    return { value: p, label: getPeriodLabel(p) };
  });

  // Calculate totals
  const totalBaseSalary = laborByDepartment.reduce((sum, d) => sum + d.baseSalary, 0);
  const totalBenefits = laborByDepartment.reduce((sum, d) => sum + d.benefits, 0);
  const totalPayrollTax = laborByDepartment.reduce((sum, d) => sum + d.payrollTax, 0);
  const totalOvertime = laborByDepartment.reduce((sum, d) => sum + d.overtime, 0);
  const totalLaborCost = totalBaseSalary + totalBenefits + totalPayrollTax + totalOvertime;
  const totalBudgeted = laborByDepartment.reduce((sum, d) => sum + d.budgeted, 0);
  const totalFTE = laborByDepartment.reduce((sum, d) => sum + d.fte, 0);
  const costPerFTE = totalLaborCost / totalFTE;
  const budgetVariance = totalLaborCost - totalBudgeted;

  // Overtime metrics
  const overtimePercent = (totalOvertime / totalBaseSalary) * 100;
  const overtimeThreshold = 3.0; // 3% target

  return (
    <div className="flex flex-col">
      <Header
        title="Labor Cost Analysis"
        subtitle="Comprehensive labor expense tracking"
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
                <DollarSign className="h-4 w-4" />
                Total Labor Cost
              </div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(totalLaborCost)}</div>
              <div className={cn("mt-1 text-sm", budgetVariance > 0 ? "text-red-600" : "text-emerald-600")}>
                {formatCurrency(budgetVariance, { showSign: true })} vs budget
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Users className="h-4 w-4" />
                Cost per FTE
              </div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(costPerFTE)}</div>
              <div className="mt-1 text-sm text-zinc-500">
                {totalFTE.toFixed(1)} total FTE
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Percent className="h-4 w-4" />
                Benefits Rate
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {formatPercent((totalBenefits / totalBaseSalary) * 100)}
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                {formatCurrency(totalBenefits)} total
              </div>
            </CardContent>
          </Card>
          <Card className={overtimePercent > overtimeThreshold ? "border-amber-200 bg-amber-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Clock className="h-4 w-4" />
                Overtime Rate
              </div>
              <div className={cn("mt-1 text-2xl font-semibold", overtimePercent > overtimeThreshold ? "text-amber-600" : "")}>
                {formatPercent(overtimePercent)}
              </div>
              <div className={cn("mt-1 text-sm", overtimePercent > overtimeThreshold ? "text-amber-600" : "text-zinc-500")}>
                {overtimePercent > overtimeThreshold && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                Target: {formatPercent(overtimeThreshold)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Labor Cost Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={laborCostTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e4e4e7",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="salaries" name="Base Salaries" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="benefits" name="Benefits" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="payrollTax" name="Payroll Tax" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="overtime" name="Overtime" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.8} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost Composition</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={costComposition}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                  >
                    {costComposition.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {costComposition.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                    <span className="text-zinc-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Department Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Labor Cost by Department
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">FTE</TableHead>
                  <TableHead className="text-right">Base Salary</TableHead>
                  <TableHead className="text-right">Benefits</TableHead>
                  <TableHead className="text-right">Payroll Tax</TableHead>
                  <TableHead className="text-right">Overtime</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laborByDepartment.map((dept) => {
                  const totalCost = dept.baseSalary + dept.benefits + dept.payrollTax + dept.overtime;
                  const variance = totalCost - dept.budgeted;
                  return (
                    <TableRow key={dept.department}>
                      <TableCell className="font-medium">{dept.department}</TableCell>
                      <TableCell className="text-right">{dept.fte.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(dept.baseSalary)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(dept.benefits)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(dept.payrollTax)}</TableCell>
                      <TableCell className="text-right">
                        {dept.overtime > 0 ? (
                          <span className={dept.overtime > dept.baseSalary * 0.03 ? "text-amber-600" : ""}>
                            {formatCurrency(dept.overtime)}
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(totalCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(dept.budgeted)}</TableCell>
                      <TableCell className="text-right">
                        <span className={variance > 0 ? "text-red-600" : "text-emerald-600"}>
                          {formatCurrency(variance, { showSign: true })}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-zinc-100 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{totalFTE.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalBaseSalary)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalBenefits)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalPayrollTax)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalOvertime)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalLaborCost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalBudgeted)}</TableCell>
                  <TableCell className="text-right">
                    <span className={budgetVariance > 0 ? "text-red-600" : "text-emerald-600"}>
                      {formatCurrency(budgetVariance, { showSign: true })}
                    </span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {/* Cost Metrics Note */}
            <div className="mt-4 rounded-lg bg-zinc-50 p-4">
              <div className="text-sm font-medium">Cost Metrics</div>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-zinc-600 md:grid-cols-4">
                <div>
                  <span className="font-medium">Benefits Rate:</span> 18% of base
                </div>
                <div>
                  <span className="font-medium">Payroll Tax Rate:</span> 8% of base
                </div>
                <div>
                  <span className="font-medium">Fully Loaded:</span> 126% of base
                </div>
                <div>
                  <span className="font-medium">OT Target:</span> &lt;3% of base
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
