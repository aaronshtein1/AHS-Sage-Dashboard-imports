"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, getCurrentPeriod, getPeriodLabel, getPreviousPeriod } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Demo Balance Sheet data
const demoBalanceSheetData = {
  assets: {
    current: [
      { id: "1000", name: "Cash & Cash Equivalents", current: 1250000, prior: 1180000 },
      { id: "1100", name: "Accounts Receivable", current: 845000, prior: 782000 },
      { id: "1200", name: "Medical Supplies Inventory", current: 125000, prior: 118000 },
      { id: "1300", name: "Prepaid Expenses", current: 68000, prior: 72000 },
    ],
    fixed: [
      { id: "1500", name: "Medical Equipment", current: 2450000, prior: 2380000 },
      { id: "1510", name: "Less: Accumulated Depreciation", current: -685000, prior: -620000 },
      { id: "1600", name: "Leasehold Improvements", current: 520000, prior: 520000 },
      { id: "1610", name: "Less: Accumulated Amortization", current: -156000, prior: -143000 },
      { id: "1700", name: "Furniture & Fixtures", current: 185000, prior: 178000 },
      { id: "1710", name: "Less: Accumulated Depreciation", current: -92000, prior: -85000 },
    ],
    other: [
      { id: "1800", name: "Security Deposits", current: 45000, prior: 45000 },
      { id: "1900", name: "Intangible Assets", current: 125000, prior: 135000 },
    ],
  },
  liabilities: {
    current: [
      { id: "2000", name: "Accounts Payable", current: 285000, prior: 265000 },
      { id: "2100", name: "Accrued Expenses", current: 142000, prior: 128000 },
      { id: "2200", name: "Accrued Payroll", current: 198000, prior: 185000 },
      { id: "2300", name: "Unearned Revenue", current: 85000, prior: 92000 },
      { id: "2400", name: "Current Portion of Long-Term Debt", current: 120000, prior: 120000 },
    ],
    longTerm: [
      { id: "2500", name: "Equipment Loans", current: 680000, prior: 750000 },
      { id: "2600", name: "Building Lease Liability", current: 425000, prior: 465000 },
      { id: "2700", name: "Other Long-Term Liabilities", current: 85000, prior: 95000 },
    ],
  },
  equity: [
    { id: "3000", name: "Common Stock", current: 500000, prior: 500000 },
    { id: "3100", name: "Retained Earnings", current: 2435000, prior: 2150000 },
    { id: "3200", name: "Current Year Net Income", current: 485000, prior: 428000 },
  ],
};

export default function BalanceSheetPage() {
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "Current Assets",
    "Fixed Assets",
    "Other Assets",
    "Current Liabilities",
    "Long-Term Liabilities",
    "Equity",
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

  const sumAccounts = (accounts: { current: number; prior: number }[]) => ({
    current: accounts.reduce((sum, acc) => sum + acc.current, 0),
    prior: accounts.reduce((sum, acc) => sum + acc.prior, 0),
  });

  const currentAssets = sumAccounts(demoBalanceSheetData.assets.current);
  const fixedAssets = sumAccounts(demoBalanceSheetData.assets.fixed);
  const otherAssets = sumAccounts(demoBalanceSheetData.assets.other);
  const totalAssets = {
    current: currentAssets.current + fixedAssets.current + otherAssets.current,
    prior: currentAssets.prior + fixedAssets.prior + otherAssets.prior,
  };

  const currentLiabilities = sumAccounts(demoBalanceSheetData.liabilities.current);
  const longTermLiabilities = sumAccounts(demoBalanceSheetData.liabilities.longTerm);
  const totalLiabilities = {
    current: currentLiabilities.current + longTermLiabilities.current,
    prior: currentLiabilities.prior + longTermLiabilities.prior,
  };

  const totalEquity = sumAccounts(demoBalanceSheetData.equity);

  const renderSection = (
    title: string,
    accounts: { id: string; name: string; current: number; prior: number }[],
    totals: { current: number; prior: number }
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
          <TableCell className="text-right font-semibold">{formatCurrency(totals.current)}</TableCell>
          <TableCell className="text-right font-semibold">{formatCurrency(totals.prior)}</TableCell>
          <TableCell className="text-right font-semibold">
            <span className={totals.current - totals.prior >= 0 ? "text-emerald-600" : "text-red-600"}>
              {formatCurrency(totals.current - totals.prior, { showSign: true })}
            </span>
          </TableCell>
        </TableRow>
        {isExpanded &&
          accounts.map((account) => (
            <TableRow key={account.id} className="hover:bg-zinc-50">
              <TableCell className="pl-10">{account.name}</TableCell>
              <TableCell className="text-right">{formatCurrency(account.current)}</TableCell>
              <TableCell className="text-right">{formatCurrency(account.prior)}</TableCell>
              <TableCell className="text-right">
                <span className={account.current - account.prior >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {formatCurrency(account.current - account.prior, { showSign: true })}
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
        title="Balance Sheet"
        subtitle={getPeriodLabel(period)}
        period={period}
        onPeriodChange={setPeriod}
        periods={periods}
        showExport
        onExport={() => console.log("Export")}
      />

      <div className="p-6">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Total Assets</div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(totalAssets.current)}</div>
              <div className={cn("mt-1 text-sm", totalAssets.current - totalAssets.prior >= 0 ? "text-emerald-600" : "text-red-600")}>
                {formatCurrency(totalAssets.current - totalAssets.prior, { showSign: true })} vs prior
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Total Liabilities</div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(totalLiabilities.current)}</div>
              <div className={cn("mt-1 text-sm", totalLiabilities.current - totalLiabilities.prior <= 0 ? "text-emerald-600" : "text-red-600")}>
                {formatCurrency(totalLiabilities.current - totalLiabilities.prior, { showSign: true })} vs prior
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Total Equity</div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(totalEquity.current)}</div>
              <div className={cn("mt-1 text-sm", totalEquity.current - totalEquity.prior >= 0 ? "text-emerald-600" : "text-red-600")}>
                {formatCurrency(totalEquity.current - totalEquity.prior, { showSign: true })} vs prior
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Working Capital</div>
              <div className="mt-1 text-2xl font-semibold">
                {formatCurrency(currentAssets.current - currentLiabilities.current)}
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Current Ratio: {(currentAssets.current / currentLiabilities.current).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Balance Sheet Table */}
        <Card>
          <CardHeader>
            <CardTitle>Statement of Financial Position</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Account</TableHead>
                  <TableHead className="text-right">Current Period</TableHead>
                  <TableHead className="text-right">Prior Period</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* ASSETS */}
                <TableRow className="bg-zinc-900 text-white">
                  <TableCell colSpan={4} className="font-bold">ASSETS</TableCell>
                </TableRow>
                {renderSection("Current Assets", demoBalanceSheetData.assets.current, currentAssets)}
                {renderSection("Fixed Assets", demoBalanceSheetData.assets.fixed, fixedAssets)}
                {renderSection("Other Assets", demoBalanceSheetData.assets.other, otherAssets)}
                <TableRow className="border-t-2 bg-zinc-100 font-bold">
                  <TableCell>Total Assets</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalAssets.current)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalAssets.prior)}</TableCell>
                  <TableCell className="text-right">
                    <span className={totalAssets.current - totalAssets.prior >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {formatCurrency(totalAssets.current - totalAssets.prior, { showSign: true })}
                    </span>
                  </TableCell>
                </TableRow>

                {/* LIABILITIES */}
                <TableRow className="bg-zinc-900 text-white">
                  <TableCell colSpan={4} className="font-bold">LIABILITIES</TableCell>
                </TableRow>
                {renderSection("Current Liabilities", demoBalanceSheetData.liabilities.current, currentLiabilities)}
                {renderSection("Long-Term Liabilities", demoBalanceSheetData.liabilities.longTerm, longTermLiabilities)}
                <TableRow className="border-t-2 bg-zinc-100 font-bold">
                  <TableCell>Total Liabilities</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalLiabilities.current)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalLiabilities.prior)}</TableCell>
                  <TableCell className="text-right">
                    <span className={totalLiabilities.current - totalLiabilities.prior <= 0 ? "text-emerald-600" : "text-red-600"}>
                      {formatCurrency(totalLiabilities.current - totalLiabilities.prior, { showSign: true })}
                    </span>
                  </TableCell>
                </TableRow>

                {/* EQUITY */}
                <TableRow className="bg-zinc-900 text-white">
                  <TableCell colSpan={4} className="font-bold">EQUITY</TableCell>
                </TableRow>
                {renderSection("Equity", demoBalanceSheetData.equity, totalEquity)}
                <TableRow className="border-t-2 bg-zinc-100 font-bold">
                  <TableCell>Total Equity</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalEquity.current)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalEquity.prior)}</TableCell>
                  <TableCell className="text-right">
                    <span className={totalEquity.current - totalEquity.prior >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {formatCurrency(totalEquity.current - totalEquity.prior, { showSign: true })}
                    </span>
                  </TableCell>
                </TableRow>

                {/* TOTAL */}
                <TableRow className="bg-zinc-900 text-white font-bold">
                  <TableCell>Total Liabilities & Equity</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalLiabilities.current + totalEquity.current)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalLiabilities.prior + totalEquity.prior)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency((totalLiabilities.current + totalEquity.current) - (totalLiabilities.prior + totalEquity.prior), { showSign: true })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
