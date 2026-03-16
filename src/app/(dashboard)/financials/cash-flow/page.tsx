"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, getCurrentPeriod, getPeriodLabel, getPreviousPeriod } from "@/lib/utils";
import { ChevronRight, TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// Demo Cash Flow data
const demoCashFlowData = {
  operating: [
    { id: "o1", name: "Net Income", amount: 485200 },
    { id: "o2", name: "Depreciation & Amortization", amount: 78000 },
    { id: "o3", name: "Increase in Accounts Receivable", amount: -63000 },
    { id: "o4", name: "Increase in Inventory", amount: -7000 },
    { id: "o5", name: "Decrease in Prepaid Expenses", amount: 4000 },
    { id: "o6", name: "Increase in Accounts Payable", amount: 20000 },
    { id: "o7", name: "Increase in Accrued Expenses", amount: 14000 },
    { id: "o8", name: "Increase in Accrued Payroll", amount: 13000 },
    { id: "o9", name: "Decrease in Unearned Revenue", amount: -7000 },
  ],
  investing: [
    { id: "i1", name: "Purchase of Medical Equipment", amount: -70000 },
    { id: "i2", name: "Purchase of Furniture & Fixtures", amount: -7000 },
    { id: "i3", name: "Proceeds from Asset Disposal", amount: 5000 },
  ],
  financing: [
    { id: "f1", name: "Repayment of Equipment Loans", amount: -70000 },
    { id: "f2", name: "Lease Principal Payments", amount: -40000 },
    { id: "f3", name: "Other Debt Payments", amount: -10000 },
    { id: "f4", name: "Dividends Paid", amount: -200000 },
  ],
};

// Cash flow trend data
const cashFlowTrend = [
  { month: "Jul", operating: 425000, investing: -85000, financing: -180000, netCash: 1050000 },
  { month: "Aug", operating: 480000, investing: -45000, financing: -200000, netCash: 1085000 },
  { month: "Sep", operating: 510000, investing: -120000, financing: -150000, netCash: 1125000 },
  { month: "Oct", operating: 465000, investing: -60000, financing: -220000, netCash: 1110000 },
  { month: "Nov", operating: 520000, investing: -35000, financing: -185000, netCash: 1180000 },
  { month: "Dec", operating: 537200, investing: -72000, financing: -320000, netCash: 1250000 },
];

export default function CashFlowPage() {
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "Operating Activities",
    "Investing Activities",
    "Financing Activities",
  ]);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const periods = Array.from({ length: 12 }, (_, i) => {
    const p = getPreviousPeriod(getCurrentPeriod(), i);
    return { value: p, label: getPeriodLabel(p) };
  });

  const sumSection = (items: { amount: number }[]) =>
    items.reduce((sum, item) => sum + item.amount, 0);

  const operatingTotal = sumSection(demoCashFlowData.operating);
  const investingTotal = sumSection(demoCashFlowData.investing);
  const financingTotal = sumSection(demoCashFlowData.financing);
  const netCashChange = operatingTotal + investingTotal + financingTotal;
  const beginningCash = 1180000;
  const endingCash = beginningCash + netCashChange;

  const renderSection = (
    title: string,
    items: { id: string; name: string; amount: number }[],
    total: number
  ) => {
    const isExpanded = expandedSections.includes(title);
    return (
      <>
        <TableRow
          className="cursor-pointer bg-zinc-50 hover:bg-zinc-100"
          onClick={() => toggleSection(title)}
        >
          <TableCell className="font-semibold">
            <div className="flex items-center gap-2">
              <ChevronRight
                className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")}
              />
              {title}
            </div>
          </TableCell>
          <TableCell className="text-right font-semibold">
            <span className={total >= 0 ? "text-emerald-600" : "text-red-600"}>
              {formatCurrency(total, { showSign: true })}
            </span>
          </TableCell>
        </TableRow>
        {isExpanded &&
          items.map((item) => (
            <TableRow key={item.id} className="hover:bg-zinc-50">
              <TableCell className="pl-10">{item.name}</TableCell>
              <TableCell className="text-right">
                <span className={item.amount >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {formatCurrency(item.amount, { showSign: true })}
                </span>
              </TableCell>
            </TableRow>
          ))}
      </>
    );
  };

  return (
    <div className="flex flex-col">
      <Header
        title="Cash Flow Statement"
        subtitle={getPeriodLabel(period)}
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
                Ending Cash Position
              </div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(endingCash)}</div>
              <div className={cn("mt-1 flex items-center gap-1 text-sm", netCashChange >= 0 ? "text-emerald-600" : "text-red-600")}>
                {netCashChange >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {formatCurrency(netCashChange, { showSign: true })} this period
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Operating Cash Flow</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-600">
                {formatCurrency(operatingTotal, { showSign: true })}
              </div>
              <div className="mt-1 text-sm text-zinc-500">From core operations</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Investing Cash Flow</div>
              <div className="mt-1 text-2xl font-semibold text-red-600">
                {formatCurrency(investingTotal, { showSign: true })}
              </div>
              <div className="mt-1 text-sm text-zinc-500">Capital expenditures</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Financing Cash Flow</div>
              <div className="mt-1 text-2xl font-semibold text-red-600">
                {formatCurrency(financingTotal, { showSign: true })}
              </div>
              <div className="mt-1 text-sm text-zinc-500">Debt & dividends</div>
            </CardContent>
          </Card>
        </div>

        {/* Cash Flow Trend Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cash Flow Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cashFlowTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), ""]}
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e4e4e7",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="operating"
                  name="Operating"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="investing"
                  name="Investing"
                  stackId="2"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="financing"
                  name="Financing"
                  stackId="3"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cash Flow Statement Table */}
        <Card>
          <CardHeader>
            <CardTitle>Statement of Cash Flows</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60%]">Item</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Beginning Cash */}
                <TableRow className="bg-zinc-100">
                  <TableCell className="font-semibold">Beginning Cash Balance</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(beginningCash)}</TableCell>
                </TableRow>

                {/* Operating Activities */}
                {renderSection("Operating Activities", demoCashFlowData.operating, operatingTotal)}

                {/* Investing Activities */}
                {renderSection("Investing Activities", demoCashFlowData.investing, investingTotal)}

                {/* Financing Activities */}
                {renderSection("Financing Activities", demoCashFlowData.financing, financingTotal)}

                {/* Net Change */}
                <TableRow className="border-t-2 bg-zinc-100 font-bold">
                  <TableCell>Net Change in Cash</TableCell>
                  <TableCell className="text-right">
                    <span className={netCashChange >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {formatCurrency(netCashChange, { showSign: true })}
                    </span>
                  </TableCell>
                </TableRow>

                {/* Ending Cash */}
                <TableRow className="bg-zinc-900 text-white font-bold">
                  <TableCell>Ending Cash Balance</TableCell>
                  <TableCell className="text-right">{formatCurrency(endingCash)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
