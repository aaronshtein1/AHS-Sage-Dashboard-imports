"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { FileText, TrendingUp, TrendingDown, AlertTriangle, Calendar, DollarSign, Percent } from "lucide-react";

// Demo contract data
const demoContracts = [
  {
    id: "c1",
    payer: "Blue Cross Blue Shield",
    type: "Commercial",
    effectiveDate: "2024-01-01",
    expirationDate: "2025-12-31",
    status: "active",
    annualVolume: 4250,
    avgReimbursement: 285,
    totalRevenue: 1211250,
    collectionRate: 94.5,
    daysToCollect: 32,
    feeSchedulePercent: 112,
  },
  {
    id: "c2",
    payer: "Aetna",
    type: "Commercial",
    effectiveDate: "2024-03-01",
    expirationDate: "2026-02-28",
    status: "active",
    annualVolume: 2800,
    avgReimbursement: 268,
    totalRevenue: 750400,
    collectionRate: 92.8,
    daysToCollect: 38,
    feeSchedulePercent: 105,
  },
  {
    id: "c3",
    payer: "UnitedHealthcare",
    type: "Commercial",
    effectiveDate: "2023-07-01",
    expirationDate: "2025-06-30",
    status: "expiring",
    annualVolume: 3100,
    avgReimbursement: 275,
    totalRevenue: 852500,
    collectionRate: 91.2,
    daysToCollect: 42,
    feeSchedulePercent: 108,
  },
  {
    id: "c4",
    payer: "Medicare",
    type: "Government",
    effectiveDate: "2024-01-01",
    expirationDate: "2024-12-31",
    status: "active",
    annualVolume: 5200,
    avgReimbursement: 185,
    totalRevenue: 962000,
    collectionRate: 98.5,
    daysToCollect: 28,
    feeSchedulePercent: 100,
  },
  {
    id: "c5",
    payer: "Medicaid",
    type: "Government",
    effectiveDate: "2024-01-01",
    expirationDate: "2024-12-31",
    status: "active",
    annualVolume: 2100,
    avgReimbursement: 125,
    totalRevenue: 262500,
    collectionRate: 96.2,
    daysToCollect: 35,
    feeSchedulePercent: 68,
  },
  {
    id: "c6",
    payer: "Cigna",
    type: "Commercial",
    effectiveDate: "2024-06-01",
    expirationDate: "2026-05-31",
    status: "active",
    annualVolume: 1850,
    avgReimbursement: 292,
    totalRevenue: 540200,
    collectionRate: 93.5,
    daysToCollect: 35,
    feeSchedulePercent: 115,
  },
  {
    id: "c7",
    payer: "Humana",
    type: "Commercial",
    effectiveDate: "2023-09-01",
    expirationDate: "2025-08-31",
    status: "expiring",
    annualVolume: 980,
    avgReimbursement: 258,
    totalRevenue: 252840,
    collectionRate: 90.8,
    daysToCollect: 45,
    feeSchedulePercent: 102,
  },
];

// Reimbursement comparison by payer type
const reimbursementByType = [
  { type: "Commercial Avg", amount: 276 },
  { type: "Medicare", amount: 185 },
  { type: "Medicaid", amount: 125 },
  { type: "Fee Schedule", amount: 255 },
];

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function ContractsPage() {
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [activeTab, setActiveTab] = useState("all");

  const periods = Array.from({ length: 12 }, (_, i) => {
    const p = getPreviousPeriod(getCurrentPeriod(), i);
    return { value: p, label: getPeriodLabel(p) };
  });

  const filteredContracts = activeTab === "all"
    ? demoContracts
    : activeTab === "expiring"
      ? demoContracts.filter(c => c.status === "expiring")
      : demoContracts.filter(c => c.type.toLowerCase() === activeTab);

  const totalRevenue = demoContracts.reduce((sum, c) => sum + c.totalRevenue, 0);
  const avgCollectionRate = demoContracts.reduce((sum, c) => sum + c.collectionRate, 0) / demoContracts.length;
  const avgDaysToCollect = Math.round(demoContracts.reduce((sum, c) => sum + c.daysToCollect, 0) / demoContracts.length);
  const expiringCount = demoContracts.filter(c => c.status === "expiring").length;

  // Revenue by payer for pie chart
  const revenueByPayer = demoContracts.map(c => ({
    name: c.payer,
    value: c.totalRevenue,
  }));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>;
      case "expiring":
        return <Badge className="bg-amber-100 text-amber-700">Expiring Soon</Badge>;
      case "expired":
        return <Badge className="bg-red-100 text-red-700">Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col">
      <Header
        title="Contract Analysis"
        subtitle="Payer contract performance and management"
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
                <FileText className="h-4 w-4" />
                Active Contracts
              </div>
              <div className="mt-1 text-2xl font-semibold">{demoContracts.length}</div>
              <div className="mt-1 text-sm text-zinc-500">
                {formatCurrency(totalRevenue)} annual revenue
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Percent className="h-4 w-4" />
                Avg Collection Rate
              </div>
              <div className="mt-1 text-2xl font-semibold">{formatPercent(avgCollectionRate)}</div>
              <div className="mt-1 text-sm text-emerald-600">+1.2% vs prior year</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Calendar className="h-4 w-4" />
                Avg Days to Collect
              </div>
              <div className="mt-1 text-2xl font-semibold">{avgDaysToCollect} days</div>
              <div className="mt-1 text-sm text-emerald-600">-3 days vs prior year</div>
            </CardContent>
          </Card>
          <Card className={expiringCount > 0 ? "border-amber-200 bg-amber-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <AlertTriangle className={cn("h-4 w-4", expiringCount > 0 && "text-amber-600")} />
                Expiring Soon
              </div>
              <div className="mt-1 text-2xl font-semibold">{expiringCount} contracts</div>
              <div className="mt-1 text-sm text-amber-600">Within 6 months</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Payer</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={revenueByPayer}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                  >
                    {revenueByPayer.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reimbursement Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={reimbursementByType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="type" tick={{ fontSize: 12 }} width={100} />
                  <Tooltip formatter={(value: number) => [`$${value}`, "Avg Reimbursement"]} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Contract Details Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contract Details
            </CardTitle>
            <Button size="sm">Add Contract</Button>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All ({demoContracts.length})</TabsTrigger>
                <TabsTrigger value="commercial">Commercial ({demoContracts.filter(c => c.type === "Commercial").length})</TabsTrigger>
                <TabsTrigger value="government">Government ({demoContracts.filter(c => c.type === "Government").length})</TabsTrigger>
                <TabsTrigger value="expiring">
                  Expiring ({expiringCount})
                  {expiringCount > 0 && <span className="ml-1 h-2 w-2 rounded-full bg-amber-500" />}
                </TabsTrigger>
              </TabsList>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Avg Reimb.</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Collection %</TableHead>
                    <TableHead className="text-right">Days to Collect</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => (
                    <TableRow key={contract.id} className="hover:bg-zinc-50 cursor-pointer">
                      <TableCell className="font-medium">{contract.payer}</TableCell>
                      <TableCell>{contract.type}</TableCell>
                      <TableCell>{getStatusBadge(contract.status)}</TableCell>
                      <TableCell>{contract.expirationDate}</TableCell>
                      <TableCell className="text-right">{contract.annualVolume.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(contract.avgReimbursement)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(contract.totalRevenue)}</TableCell>
                      <TableCell className="text-right">
                        <span className={contract.collectionRate >= 93 ? "text-emerald-600" : contract.collectionRate >= 90 ? "text-amber-600" : "text-red-600"}>
                          {formatPercent(contract.collectionRate)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={contract.daysToCollect <= 35 ? "text-emerald-600" : contract.daysToCollect <= 42 ? "text-amber-600" : "text-red-600"}>
                          {contract.daysToCollect}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
