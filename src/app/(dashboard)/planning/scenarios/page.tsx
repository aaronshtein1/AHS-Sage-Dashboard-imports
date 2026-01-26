"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
} from "recharts";
import { GitBranch, Plus, Play, Trash2, Copy, Sliders } from "lucide-react";

// Demo scenarios
const demoScenarios = [
  {
    id: "baseline",
    name: "Baseline (Current Budget)",
    description: "Current approved budget for FY2025",
    isBaseline: true,
    assumptions: {
      patientVolumeGrowth: 0,
      reimbursementChange: 0,
      headcountChange: 0,
      supplyInflation: 0,
    },
    results: {
      revenue: 32500000,
      expenses: 27800000,
      netIncome: 4700000,
      margin: 14.5,
    },
  },
  {
    id: "optimistic",
    name: "Growth Scenario",
    description: "Higher patient volume, new payer contracts",
    isBaseline: false,
    assumptions: {
      patientVolumeGrowth: 8,
      reimbursementChange: 3,
      headcountChange: 5,
      supplyInflation: 2,
    },
    results: {
      revenue: 36200000,
      expenses: 29500000,
      netIncome: 6700000,
      margin: 18.5,
    },
  },
  {
    id: "conservative",
    name: "Conservative Scenario",
    description: "Flat volume, Medicare cuts",
    isBaseline: false,
    assumptions: {
      patientVolumeGrowth: -2,
      reimbursementChange: -4,
      headcountChange: 0,
      supplyInflation: 3,
    },
    results: {
      revenue: 30100000,
      expenses: 27200000,
      netIncome: 2900000,
      margin: 9.6,
    },
  },
  {
    id: "expansion",
    name: "New Location Expansion",
    description: "Open new clinic in Q3",
    isBaseline: false,
    assumptions: {
      patientVolumeGrowth: 15,
      reimbursementChange: 0,
      headcountChange: 12,
      supplyInflation: 2,
    },
    results: {
      revenue: 38500000,
      expenses: 33200000,
      netIncome: 5300000,
      margin: 13.8,
    },
  },
];

// Chart data for comparison
const comparisonData = demoScenarios.map((s) => ({
  name: s.name.split(" ")[0],
  revenue: s.results.revenue,
  expenses: s.results.expenses,
  netIncome: s.results.netIncome,
}));

export default function ScenariosPage() {
  const [selectedScenario, setSelectedScenario] = useState<string | null>("optimistic");

  const selectedData = demoScenarios.find((s) => s.id === selectedScenario);
  const baselineData = demoScenarios.find((s) => s.isBaseline);

  return (
    <div className="flex flex-col">
      <Header
        title="Scenario Planning"
        subtitle="Compare different financial scenarios and assumptions"
        showExport
        onExport={() => console.log("Export")}
      >
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Scenario
        </Button>
      </Header>

      <div className="p-6">
        {/* Scenario Comparison Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Scenario Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`}
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
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="netIncome" name="Net Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Scenario List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {demoScenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    className={cn(
                      "cursor-pointer rounded-lg border p-3 transition-colors",
                      selectedScenario === scenario.id
                        ? "border-blue-500 bg-blue-50"
                        : "hover:bg-zinc-50"
                    )}
                    onClick={() => setSelectedScenario(scenario.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{scenario.name}</span>
                      {scenario.isBaseline && (
                        <Badge variant="secondary">Baseline</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">{scenario.description}</p>
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-zinc-500">Net Income:</span>
                      <span className="font-medium">{formatCurrency(scenario.results.netIncome)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Scenario Details */}
          {selectedData && (
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{selectedData.name}</CardTitle>
                  <CardDescription>{selectedData.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Copy className="mr-2 h-4 w-4" />
                    Clone
                  </Button>
                  {!selectedData.isBaseline && (
                    <Button variant="outline" size="sm" className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Assumptions */}
                <div className="mb-6">
                  <h4 className="mb-3 flex items-center gap-2 font-medium">
                    <Sliders className="h-4 w-4" />
                    Assumptions
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-zinc-50 p-3">
                      <div className="text-sm text-zinc-500">Patient Volume Growth</div>
                      <div className="mt-1 text-lg font-semibold">
                        {selectedData.assumptions.patientVolumeGrowth > 0 ? "+" : ""}
                        {selectedData.assumptions.patientVolumeGrowth}%
                      </div>
                    </div>
                    <div className="rounded-lg bg-zinc-50 p-3">
                      <div className="text-sm text-zinc-500">Reimbursement Change</div>
                      <div className="mt-1 text-lg font-semibold">
                        {selectedData.assumptions.reimbursementChange > 0 ? "+" : ""}
                        {selectedData.assumptions.reimbursementChange}%
                      </div>
                    </div>
                    <div className="rounded-lg bg-zinc-50 p-3">
                      <div className="text-sm text-zinc-500">Headcount Change</div>
                      <div className="mt-1 text-lg font-semibold">
                        {selectedData.assumptions.headcountChange > 0 ? "+" : ""}
                        {selectedData.assumptions.headcountChange} FTE
                      </div>
                    </div>
                    <div className="rounded-lg bg-zinc-50 p-3">
                      <div className="text-sm text-zinc-500">Supply Inflation</div>
                      <div className="mt-1 text-lg font-semibold">
                        +{selectedData.assumptions.supplyInflation}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Results Comparison */}
                <div>
                  <h4 className="mb-3 font-medium">Results vs Baseline</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead className="text-right">Baseline</TableHead>
                        <TableHead className="text-right">This Scenario</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Revenue</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(baselineData?.results.revenue || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(selectedData.results.revenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "font-medium",
                              selectedData.results.revenue >= (baselineData?.results.revenue || 0)
                                ? "text-emerald-600"
                                : "text-red-600"
                            )}
                          >
                            {formatCurrency(
                              selectedData.results.revenue - (baselineData?.results.revenue || 0),
                              { showSign: true }
                            )}
                          </span>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Expenses</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(baselineData?.results.expenses || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(selectedData.results.expenses)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "font-medium",
                              selectedData.results.expenses <= (baselineData?.results.expenses || 0)
                                ? "text-emerald-600"
                                : "text-red-600"
                            )}
                          >
                            {formatCurrency(
                              selectedData.results.expenses - (baselineData?.results.expenses || 0),
                              { showSign: true }
                            )}
                          </span>
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-zinc-50 font-semibold">
                        <TableCell>Net Income</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(baselineData?.results.netIncome || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(selectedData.results.netIncome)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              selectedData.results.netIncome >= (baselineData?.results.netIncome || 0)
                                ? "text-emerald-600"
                                : "text-red-600"
                            )}
                          >
                            {formatCurrency(
                              selectedData.results.netIncome - (baselineData?.results.netIncome || 0),
                              { showSign: true }
                            )}
                          </span>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Net Margin</TableCell>
                        <TableCell className="text-right">
                          {formatPercent(baselineData?.results.margin || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(selectedData.results.margin)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "font-medium",
                              selectedData.results.margin >= (baselineData?.results.margin || 0)
                                ? "text-emerald-600"
                                : "text-red-600"
                            )}
                          >
                            {formatPercent(
                              selectedData.results.margin - (baselineData?.results.margin || 0),
                              { showSign: true }
                            )}
                          </span>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
