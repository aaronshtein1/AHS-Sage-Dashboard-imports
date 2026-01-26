"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
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
import { Building2, TrendingUp, TrendingDown, Users, DollarSign } from "lucide-react";

// Demo location data
const demoLocations = [
  {
    id: "loc1",
    name: "Downtown Clinic",
    type: "Primary Care",
    grossRevenue: 980000,
    adjustments: -98000,
    netRevenue: 882000,
    directCosts: 542000,
    grossProfit: 340000,
    grossMargin: 38.5,
    operatingExpenses: 185000,
    netIncome: 155000,
    netMargin: 17.6,
    patientVolume: 2850,
    revenuePerVisit: 309,
    priorGrossProfit: 315000,
    budgetGrossProfit: 330000,
    staffCount: 18,
  },
  {
    id: "loc2",
    name: "Westside Office",
    type: "Specialty",
    grossRevenue: 720000,
    adjustments: -72000,
    netRevenue: 648000,
    directCosts: 420000,
    grossProfit: 228000,
    grossMargin: 35.2,
    operatingExpenses: 142000,
    netIncome: 86000,
    netMargin: 13.3,
    patientVolume: 1920,
    revenuePerVisit: 338,
    priorGrossProfit: 210000,
    budgetGrossProfit: 225000,
    staffCount: 12,
  },
  {
    id: "loc3",
    name: "North Campus",
    type: "Primary Care",
    grossRevenue: 545000,
    adjustments: -54500,
    netRevenue: 490500,
    directCosts: 351000,
    grossProfit: 139500,
    grossMargin: 28.4,
    operatingExpenses: 108000,
    netIncome: 31500,
    netMargin: 6.4,
    patientVolume: 1650,
    revenuePerVisit: 297,
    priorGrossProfit: 158000,
    budgetGrossProfit: 165000,
    staffCount: 10,
  },
  {
    id: "loc4",
    name: "East Medical Center",
    type: "Urgent Care",
    grossRevenue: 602500,
    adjustments: -60250,
    netRevenue: 542250,
    directCosts: 368000,
    grossProfit: 174250,
    grossMargin: 32.1,
    operatingExpenses: 125000,
    netIncome: 49250,
    netMargin: 9.1,
    patientVolume: 2100,
    revenuePerVisit: 258,
    priorGrossProfit: 170000,
    budgetGrossProfit: 175000,
    staffCount: 14,
  },
];

// Chart data for comparison
const comparisonData = demoLocations.map((loc) => ({
  name: loc.name.split(" ")[0],
  revenue: loc.netRevenue,
  grossProfit: loc.grossProfit,
  netIncome: loc.netIncome,
}));

const marginData = demoLocations.map((loc) => ({
  name: loc.name.split(" ")[0],
  grossMargin: loc.grossMargin,
  netMargin: loc.netMargin,
}));

export default function LocationsPage() {
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  const periods = Array.from({ length: 12 }, (_, i) => {
    const p = getPreviousPeriod(getCurrentPeriod(), i);
    return { value: p, label: getPeriodLabel(p) };
  });

  // Calculate totals
  const totals = demoLocations.reduce(
    (acc, loc) => ({
      grossRevenue: acc.grossRevenue + loc.grossRevenue,
      netRevenue: acc.netRevenue + loc.netRevenue,
      grossProfit: acc.grossProfit + loc.grossProfit,
      netIncome: acc.netIncome + loc.netIncome,
      patientVolume: acc.patientVolume + loc.patientVolume,
      staffCount: acc.staffCount + loc.staffCount,
    }),
    { grossRevenue: 0, netRevenue: 0, grossProfit: 0, netIncome: 0, patientVolume: 0, staffCount: 0 }
  );

  const avgGrossMargin = (totals.grossProfit / totals.netRevenue) * 100;
  const avgNetMargin = (totals.netIncome / totals.netRevenue) * 100;

  return (
    <div className="flex flex-col">
      <Header
        title="Location Profitability"
        subtitle={`Period: ${getPeriodLabel(period)}`}
        period={period}
        onPeriodChange={setPeriod}
        periods={periods}
        showExport
        onExport={() => console.log("Export")}
      />

      <div className="p-6">
        {/* Summary KPIs */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <KPICard title="Total Net Revenue" value={totals.netRevenue} />
          <KPICard title="Total Gross Profit" value={totals.grossProfit} />
          <KPICard
            title="Avg Gross Margin"
            value={avgGrossMargin}
            format="percent"
          />
          <KPICard title="Total Patient Volume" value={totals.patientVolume} format="number" />
          <KPICard title="Total Staff" value={totals.staffCount} format="number" />
        </div>

        {/* Charts */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue & Profitability by Location</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
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
                  <Bar dataKey="revenue" name="Net Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="grossProfit" name="Gross Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="netIncome" name="Net Income" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Margin Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={marginData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 50]}
                  />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e4e4e7",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="grossMargin" name="Gross Margin" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="netMargin" name="Net Margin" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Location Details Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Location P&L Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Net Revenue</TableHead>
                  <TableHead className="text-right">Direct Costs</TableHead>
                  <TableHead className="text-right">Gross Profit</TableHead>
                  <TableHead className="text-right">Gross Margin</TableHead>
                  <TableHead className="text-right">Net Income</TableHead>
                  <TableHead className="text-right">Patients</TableHead>
                  <TableHead className="text-right">Rev/Visit</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoLocations.map((loc) => {
                  const variance = loc.grossProfit - loc.budgetGrossProfit;
                  const variancePercent = (variance / loc.budgetGrossProfit) * 100;
                  const isPositive = variance >= 0;

                  return (
                    <TableRow
                      key={loc.id}
                      className={cn(
                        "cursor-pointer",
                        selectedLocation === loc.id && "bg-zinc-50"
                      )}
                      onClick={() =>
                        setSelectedLocation(selectedLocation === loc.id ? null : loc.id)
                      }
                    >
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{loc.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(loc.netRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(loc.directCosts)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(loc.grossProfit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "font-medium",
                            loc.grossMargin >= 35
                              ? "text-emerald-600"
                              : loc.grossMargin >= 30
                              ? "text-amber-600"
                              : "text-red-600"
                          )}
                        >
                          {formatPercent(loc.grossMargin)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(loc.netIncome)}
                      </TableCell>
                      <TableCell className="text-right">
                        {loc.patientVolume.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(loc.revenuePerVisit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isPositive ? (
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <span
                            className={cn(
                              "font-medium",
                              isPositive ? "text-emerald-600" : "text-red-600"
                            )}
                          >
                            {formatPercent(variancePercent, { showSign: true })}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Totals Row */}
                <TableRow className="border-t-2 bg-zinc-100 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.netRevenue)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(demoLocations.reduce((s, l) => s + l.directCosts, 0))}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.grossProfit)}</TableCell>
                  <TableCell className="text-right">{formatPercent(avgGrossMargin)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.netIncome)}</TableCell>
                  <TableCell className="text-right">{totals.patientVolume.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(totals.netRevenue / totals.patientVolume)}
                  </TableCell>
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
