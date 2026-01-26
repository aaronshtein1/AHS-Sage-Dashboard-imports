"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Briefcase, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

// Demo payer mix data
const demoPayerData = [
  {
    id: "payer1",
    name: "Blue Cross PPO",
    contractType: "PPO",
    grossCharges: 1450000,
    payments: 1160000,
    adjustments: 290000,
    collectionRate: 80.0,
    patientCount: 1250,
    avgReimbursement: 928,
    medicarePercent: 142,
    margin: 42.0,
    trend: "up" as const,
  },
  {
    id: "payer2",
    name: "Medicare",
    contractType: "Government",
    grossCharges: 1120000,
    payments: 672000,
    adjustments: 448000,
    collectionRate: 60.0,
    patientCount: 1800,
    avgReimbursement: 373,
    medicarePercent: 100,
    margin: 28.0,
    trend: "flat" as const,
  },
  {
    id: "payer3",
    name: "Aetna HMO",
    contractType: "HMO",
    grossCharges: 920000,
    payments: 690000,
    adjustments: 230000,
    collectionRate: 75.0,
    patientCount: 980,
    avgReimbursement: 704,
    medicarePercent: 125,
    margin: 38.0,
    trend: "up" as const,
  },
  {
    id: "payer4",
    name: "United Healthcare",
    contractType: "PPO",
    grossCharges: 680000,
    payments: 510000,
    adjustments: 170000,
    collectionRate: 75.0,
    patientCount: 720,
    avgReimbursement: 708,
    medicarePercent: 128,
    margin: 35.0,
    trend: "down" as const,
  },
  {
    id: "payer5",
    name: "Medicaid",
    contractType: "Government",
    grossCharges: 520000,
    payments: 234000,
    adjustments: 286000,
    collectionRate: 45.0,
    patientCount: 850,
    avgReimbursement: 275,
    medicarePercent: 65,
    margin: 18.0,
    trend: "down" as const,
  },
  {
    id: "payer6",
    name: "Self-Pay",
    contractType: "Self-Pay",
    grossCharges: 380000,
    payments: 190000,
    adjustments: 190000,
    collectionRate: 50.0,
    patientCount: 420,
    avgReimbursement: 452,
    medicarePercent: null,
    margin: 52.0,
    trend: "flat" as const,
  },
];

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#6b7280"];

export default function PayerMixPage() {
  const [period, setPeriod] = useState(getCurrentPeriod());

  const periods = Array.from({ length: 12 }, (_, i) => {
    const p = getPreviousPeriod(getCurrentPeriod(), i);
    return { value: p, label: getPeriodLabel(p) };
  });

  // Calculate totals
  const totals = demoPayerData.reduce(
    (acc, payer) => ({
      grossCharges: acc.grossCharges + payer.grossCharges,
      payments: acc.payments + payer.payments,
      adjustments: acc.adjustments + payer.adjustments,
      patientCount: acc.patientCount + payer.patientCount,
    }),
    { grossCharges: 0, payments: 0, adjustments: 0, patientCount: 0 }
  );

  const avgCollectionRate = (totals.payments / totals.grossCharges) * 100;

  // Pie chart data
  const pieData = demoPayerData.map((payer) => ({
    name: payer.name,
    value: payer.payments,
    percent: (payer.payments / totals.payments) * 100,
  }));

  // Bar chart for reimbursement comparison
  const reimbursementData = demoPayerData
    .filter((p) => p.medicarePercent !== null)
    .map((payer) => ({
      name: payer.name.split(" ")[0],
      reimbursement: payer.medicarePercent,
    }));

  return (
    <div className="flex flex-col">
      <Header
        title="Payer Mix Analysis"
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
              <div className="text-sm text-zinc-500">Total Gross Charges</div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(totals.grossCharges)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Total Payments</div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(totals.payments)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Avg Collection Rate</div>
              <div className="mt-1 text-2xl font-semibold">{formatPercent(avgCollectionRate)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Total Patients</div>
              <div className="mt-1 text-2xl font-semibold">{totals.patientCount.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Revenue by Payer Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Payer</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name.split(" ")[0]} ${percent.toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e4e4e7",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Reimbursement % of Medicare */}
          <Card>
            <CardHeader>
              <CardTitle>Reimbursement Rate (% of Medicare)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reimbursementData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 160]}
                  />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip
                    formatter={(value: number) => [`${value}% of Medicare`, ""]}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e4e4e7",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="reimbursement" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                    {reimbursementData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.reimbursement >= 100 ? "#10b981" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex justify-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-emerald-500" />
                  <span>Above Medicare</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-red-500" />
                  <span>Below Medicare</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payer Details Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Payer Contract Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Gross Charges</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead className="text-right">Collection %</TableHead>
                  <TableHead className="text-right">Patients</TableHead>
                  <TableHead className="text-right">Avg Reimb.</TableHead>
                  <TableHead className="text-right">% Medicare</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoPayerData.map((payer, idx) => (
                  <TableRow key={payer.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        {payer.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payer.contractType === "Government"
                            ? "secondary"
                            : payer.contractType === "Self-Pay"
                            ? "outline"
                            : "default"
                        }
                      >
                        {payer.contractType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(payer.grossCharges)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(payer.payments)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          payer.collectionRate >= 70
                            ? "text-emerald-600"
                            : payer.collectionRate >= 50
                            ? "text-amber-600"
                            : "text-red-600"
                        )}
                      >
                        {formatPercent(payer.collectionRate)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{payer.patientCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payer.avgReimbursement)}</TableCell>
                    <TableCell className="text-right">
                      {payer.medicarePercent !== null ? (
                        <span
                          className={cn(
                            "font-medium",
                            payer.medicarePercent >= 100 ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {payer.medicarePercent}%
                        </span>
                      ) : (
                        <span className="text-zinc-400">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "font-medium",
                          payer.margin >= 35
                            ? "text-emerald-600"
                            : payer.margin >= 25
                            ? "text-amber-600"
                            : "text-red-600"
                        )}
                      >
                        {formatPercent(payer.margin)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {payer.trend === "up" ? (
                        <TrendingUp className="inline h-4 w-4 text-emerald-500" />
                      ) : payer.trend === "down" ? (
                        <TrendingDown className="inline h-4 w-4 text-red-500" />
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Totals */}
                <TableRow className="border-t-2 bg-zinc-100 font-semibold">
                  <TableCell>Total / Average</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.grossCharges)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.payments)}</TableCell>
                  <TableCell className="text-right">{formatPercent(avgCollectionRate)}</TableCell>
                  <TableCell className="text-right">{totals.patientCount.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(totals.payments / totals.patientCount)}
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
