"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Demo P&L data structure
const demoPnLData = {
  period: getCurrentPeriod(),
  sections: [
    {
      title: "Revenue",
      isIncome: true,
      accounts: [
        { id: "4000", name: "Patient Service Revenue", current: 2450000, prior: 2280000, budget: 2400000 },
        { id: "4100", name: "Lab & Diagnostic Revenue", current: 285000, prior: 265000, budget: 290000 },
        { id: "4200", name: "Ancillary Services", current: 112500, prior: 98000, budget: 110000 },
      ],
    },
    {
      title: "Cost of Services",
      isIncome: false,
      accounts: [
        { id: "5000", name: "Medical Supplies", current: 385000, prior: 365000, budget: 370000 },
        { id: "5100", name: "Lab Costs", current: 125000, prior: 118000, budget: 120000 },
        { id: "5200", name: "Direct Labor - Clinical", current: 680000, prior: 645000, budget: 660000 },
      ],
    },
    {
      title: "Operating Expenses",
      isIncome: false,
      accounts: [
        { id: "6000", name: "Salaries - Administrative", current: 285000, prior: 275000, budget: 280000 },
        { id: "6100", name: "Benefits & Payroll Taxes", current: 245000, prior: 235000, budget: 240000 },
        { id: "6200", name: "Rent & Occupancy", current: 125000, prior: 125000, budget: 125000 },
        { id: "6300", name: "Utilities", current: 32000, prior: 28000, budget: 30000 },
        { id: "6400", name: "Insurance", current: 45000, prior: 42000, budget: 44000 },
        { id: "6500", name: "Marketing & Advertising", current: 28000, prior: 25000, budget: 35000 },
        { id: "6600", name: "Professional Fees", current: 52000, prior: 48000, budget: 50000 },
        { id: "6700", name: "Office Supplies", current: 18000, prior: 16500, budget: 17000 },
        { id: "6800", name: "IT & Software", current: 42000, prior: 38000, budget: 40000 },
        { id: "6900", name: "Depreciation", current: 65000, prior: 62000, budget: 65000 },
      ],
    },
    {
      title: "Other Income/Expense",
      isIncome: true,
      accounts: [
        { id: "7000", name: "Interest Income", current: 8500, prior: 7200, budget: 8000 },
        { id: "7100", name: "Interest Expense", current: -22000, prior: -24000, budget: -23000 },
        { id: "7200", name: "Other Income", current: 12000, prior: 8500, budget: 10000 },
      ],
    },
  ],
};

type CompareType = "prior" | "budget";

export default function PnLPage() {
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [compareType, setCompareType] = useState<CompareType>("prior");
  const [expandedSections, setExpandedSections] = useState<string[]>(
    demoPnLData.sections.map((s) => s.title)
  );

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  // Calculate totals
  const calculateSectionTotal = (accounts: typeof demoPnLData.sections[0]["accounts"]) => {
    return {
      current: accounts.reduce((sum, acc) => sum + acc.current, 0),
      prior: accounts.reduce((sum, acc) => sum + acc.prior, 0),
      budget: accounts.reduce((sum, acc) => sum + acc.budget, 0),
    };
  };

  const revenueSection = demoPnLData.sections.find((s) => s.title === "Revenue");
  const cosSection = demoPnLData.sections.find((s) => s.title === "Cost of Services");
  const opexSection = demoPnLData.sections.find((s) => s.title === "Operating Expenses");
  const otherSection = demoPnLData.sections.find((s) => s.title === "Other Income/Expense");

  const revenue = revenueSection ? calculateSectionTotal(revenueSection.accounts) : { current: 0, prior: 0, budget: 0 };
  const cos = cosSection ? calculateSectionTotal(cosSection.accounts) : { current: 0, prior: 0, budget: 0 };
  const opex = opexSection ? calculateSectionTotal(opexSection.accounts) : { current: 0, prior: 0, budget: 0 };
  const other = otherSection ? calculateSectionTotal(otherSection.accounts) : { current: 0, prior: 0, budget: 0 };

  const grossProfit = {
    current: revenue.current - cos.current,
    prior: revenue.prior - cos.prior,
    budget: revenue.budget - cos.budget,
  };

  const operatingIncome = {
    current: grossProfit.current - opex.current,
    prior: grossProfit.prior - opex.prior,
    budget: grossProfit.budget - opex.budget,
  };

  const netIncome = {
    current: operatingIncome.current + other.current,
    prior: operatingIncome.prior + other.prior,
    budget: operatingIncome.budget + other.budget,
  };

  const getCompareValue = (item: { current: number; prior: number; budget: number }) => {
    return compareType === "prior" ? item.prior : item.budget;
  };

  const getVariance = (current: number, compare: number, isIncome: boolean = true) => {
    const variance = current - compare;
    const percent = compare !== 0 ? (variance / Math.abs(compare)) * 100 : 0;
    // For income accounts, positive variance is good. For expense accounts, negative variance is good.
    const isPositive = isIncome ? variance >= 0 : variance <= 0;
    return { variance, percent, isPositive };
  };

  const periods = Array.from({ length: 12 }, (_, i) => {
    const p = getPreviousPeriod(getCurrentPeriod(), i);
    return { value: p, label: getPeriodLabel(p) };
  });

  return (
    <div className="flex flex-col">
      <Header
        title="Profit & Loss Statement"
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
              <div className="text-sm text-zinc-500">Total Revenue</div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(revenue.current)}</div>
              <div className={cn(
                "mt-1 text-sm",
                getVariance(revenue.current, getCompareValue(revenue)).isPositive ? "text-emerald-600" : "text-red-600"
              )}>
                {formatCurrency(getVariance(revenue.current, getCompareValue(revenue)).variance, { showSign: true })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Gross Profit</div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(grossProfit.current)}</div>
              <div className="mt-1 text-sm text-zinc-500">
                {formatPercent((grossProfit.current / revenue.current) * 100)} margin
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Operating Income</div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(operatingIncome.current)}</div>
              <div className="mt-1 text-sm text-zinc-500">
                {formatPercent((operatingIncome.current / revenue.current) * 100)} margin
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">Net Income</div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(netIncome.current)}</div>
              <div className={cn(
                "mt-1 text-sm",
                getVariance(netIncome.current, getCompareValue(netIncome)).isPositive ? "text-emerald-600" : "text-red-600"
              )}>
                {formatCurrency(getVariance(netIncome.current, getCompareValue(netIncome)).variance, { showSign: true })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* P&L Statement */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Income Statement</CardTitle>
            <Tabs value={compareType} onValueChange={(v) => setCompareType(v as CompareType)}>
              <TabsList>
                <TabsTrigger value="prior">vs Prior Period</TabsTrigger>
                <TabsTrigger value="budget">vs Budget</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Account</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">
                    {compareType === "prior" ? "Prior Period" : "Budget"}
                  </TableHead>
                  <TableHead className="text-right">Variance $</TableHead>
                  <TableHead className="text-right">Variance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoPnLData.sections.map((section) => {
                  const sectionTotal = calculateSectionTotal(section.accounts);
                  const isExpanded = expandedSections.includes(section.title);
                  const sectionVariance = getVariance(
                    sectionTotal.current,
                    getCompareValue(sectionTotal),
                    section.isIncome
                  );

                  return (
                    <>
                      {/* Section Header */}
                      <TableRow
                        key={section.title}
                        className="cursor-pointer bg-zinc-50 hover:bg-zinc-100"
                        onClick={() => toggleSection(section.title)}
                      >
                        <TableCell className="font-semibold">
                          <div className="flex items-center gap-2">
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-90"
                              )}
                            />
                            {section.title}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(sectionTotal.current)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(getCompareValue(sectionTotal))}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold",
                            sectionVariance.isPositive ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {formatCurrency(sectionVariance.variance, { showSign: true })}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold",
                            sectionVariance.isPositive ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {formatPercent(sectionVariance.percent, { showSign: true })}
                        </TableCell>
                      </TableRow>

                      {/* Account Details */}
                      {isExpanded &&
                        section.accounts.map((account) => {
                          const accVariance = getVariance(
                            account.current,
                            compareType === "prior" ? account.prior : account.budget,
                            section.isIncome
                          );

                          return (
                            <TableRow key={account.id} className="hover:bg-zinc-50">
                              <TableCell className="pl-10">{account.name}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(account.current)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(
                                  compareType === "prior" ? account.prior : account.budget
                                )}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right",
                                  accVariance.isPositive ? "text-emerald-600" : "text-red-600"
                                )}
                              >
                                {formatCurrency(accVariance.variance, { showSign: true })}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right",
                                  accVariance.isPositive ? "text-emerald-600" : "text-red-600"
                                )}
                              >
                                {formatPercent(accVariance.percent, { showSign: true })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </>
                  );
                })}

                {/* Gross Profit Row */}
                <TableRow className="border-t-2 bg-zinc-100 font-semibold">
                  <TableCell>Gross Profit</TableCell>
                  <TableCell className="text-right">{formatCurrency(grossProfit.current)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(getCompareValue(grossProfit))}</TableCell>
                  <TableCell className={cn("text-right", getVariance(grossProfit.current, getCompareValue(grossProfit)).isPositive ? "text-emerald-600" : "text-red-600")}>
                    {formatCurrency(getVariance(grossProfit.current, getCompareValue(grossProfit)).variance, { showSign: true })}
                  </TableCell>
                  <TableCell className={cn("text-right", getVariance(grossProfit.current, getCompareValue(grossProfit)).isPositive ? "text-emerald-600" : "text-red-600")}>
                    {formatPercent(getVariance(grossProfit.current, getCompareValue(grossProfit)).percent, { showSign: true })}
                  </TableCell>
                </TableRow>

                {/* Operating Income Row */}
                <TableRow className="bg-zinc-100 font-semibold">
                  <TableCell>Operating Income</TableCell>
                  <TableCell className="text-right">{formatCurrency(operatingIncome.current)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(getCompareValue(operatingIncome))}</TableCell>
                  <TableCell className={cn("text-right", getVariance(operatingIncome.current, getCompareValue(operatingIncome)).isPositive ? "text-emerald-600" : "text-red-600")}>
                    {formatCurrency(getVariance(operatingIncome.current, getCompareValue(operatingIncome)).variance, { showSign: true })}
                  </TableCell>
                  <TableCell className={cn("text-right", getVariance(operatingIncome.current, getCompareValue(operatingIncome)).isPositive ? "text-emerald-600" : "text-red-600")}>
                    {formatPercent(getVariance(operatingIncome.current, getCompareValue(operatingIncome)).percent, { showSign: true })}
                  </TableCell>
                </TableRow>

                {/* Net Income Row */}
                <TableRow className="border-t-2 bg-zinc-900 text-white font-bold">
                  <TableCell>Net Income</TableCell>
                  <TableCell className="text-right">{formatCurrency(netIncome.current)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(getCompareValue(netIncome))}</TableCell>
                  <TableCell className={cn("text-right", getVariance(netIncome.current, getCompareValue(netIncome)).isPositive ? "text-emerald-400" : "text-red-400")}>
                    {formatCurrency(getVariance(netIncome.current, getCompareValue(netIncome)).variance, { showSign: true })}
                  </TableCell>
                  <TableCell className={cn("text-right", getVariance(netIncome.current, getCompareValue(netIncome)).isPositive ? "text-emerald-400" : "text-red-400")}>
                    {formatPercent(getVariance(netIncome.current, getCompareValue(netIncome)).percent, { showSign: true })}
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
