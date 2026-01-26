import { NextRequest, NextResponse } from "next/server";
import { createIntacctClientFromEnv } from "@/lib/intacct/client";

// Account category mappings for P&L
const ACCOUNT_CATEGORIES = {
  revenue: ["4000", "4100", "4200", "4300", "4400", "4500"],
  costOfServices: ["5000", "5100", "5200", "5300"],
  operatingExpenses: ["6000", "6100", "6200", "6300", "6400", "6500", "6600", "6700", "6800", "6900"],
  otherIncome: ["7000", "7100", "7200"],
};

export async function GET(request: NextRequest) {
  try {
    const client = createIntacctClientFromEnv();

    if (!client) {
      // Return demo data if not configured
      return NextResponse.json({
        success: true,
        data: getDemoPnLData(),
        isDemo: true,
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period");
    const comparisonPeriod = searchParams.get("comparisonPeriod");
    const locationId = searchParams.get("locationId") || undefined;

    if (!period) {
      return NextResponse.json(
        { success: false, error: "Period parameter is required" },
        { status: 400 }
      );
    }

    // Fetch current period balances
    const currentBalances = await client.getAccountBalances(period, { locationId });

    // Fetch comparison period balances if requested
    let comparisonBalances = null;
    if (comparisonPeriod) {
      comparisonBalances = await client.getAccountBalances(comparisonPeriod, { locationId });
    }

    // Build P&L structure
    const pnl = buildPnLStatement(currentBalances, comparisonBalances);

    return NextResponse.json({
      success: true,
      data: pnl,
      period,
      comparisonPeriod,
    });
  } catch (error) {
    console.error("Error generating P&L:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate P&L",
      },
      { status: 500 }
    );
  }
}

function buildPnLStatement(
  currentBalances: Array<{ ACCOUNTNO: string; ACCOUNTTITLE: string; ENDBALANCE: number }>,
  comparisonBalances: Array<{ ACCOUNTNO: string; ENDBALANCE: number }> | null
) {
  // Group balances by account
  const currentMap = new Map(
    currentBalances.map((b) => [b.ACCOUNTNO, b])
  );
  const comparisonMap = comparisonBalances
    ? new Map(comparisonBalances.map((b) => [b.ACCOUNTNO, b]))
    : null;

  const categorizeAccounts = (accountNos: string[]) => {
    return currentBalances
      .filter((b) => accountNos.some((prefix) => b.ACCOUNTNO.startsWith(prefix)))
      .map((b) => ({
        accountNo: b.ACCOUNTNO,
        title: b.ACCOUNTTITLE,
        current: Math.abs(b.ENDBALANCE),
        comparison: comparisonMap
          ? Math.abs(comparisonMap.get(b.ACCOUNTNO)?.ENDBALANCE || 0)
          : undefined,
      }));
  };

  const sumCategory = (accounts: Array<{ current: number; comparison?: number }>) => ({
    current: accounts.reduce((sum, a) => sum + a.current, 0),
    comparison: accounts[0]?.comparison !== undefined
      ? accounts.reduce((sum, a) => sum + (a.comparison || 0), 0)
      : undefined,
  });

  const revenue = categorizeAccounts(ACCOUNT_CATEGORIES.revenue);
  const costOfServices = categorizeAccounts(ACCOUNT_CATEGORIES.costOfServices);
  const operatingExpenses = categorizeAccounts(ACCOUNT_CATEGORIES.operatingExpenses);
  const otherIncome = categorizeAccounts(ACCOUNT_CATEGORIES.otherIncome);

  const revenueTotal = sumCategory(revenue);
  const cosTotal = sumCategory(costOfServices);
  const opexTotal = sumCategory(operatingExpenses);
  const otherTotal = sumCategory(otherIncome);

  const grossProfit = {
    current: revenueTotal.current - cosTotal.current,
    comparison: revenueTotal.comparison !== undefined
      ? (revenueTotal.comparison || 0) - (cosTotal.comparison || 0)
      : undefined,
  };

  const operatingIncome = {
    current: grossProfit.current - opexTotal.current,
    comparison: grossProfit.comparison !== undefined
      ? (grossProfit.comparison || 0) - (opexTotal.comparison || 0)
      : undefined,
  };

  const netIncome = {
    current: operatingIncome.current + otherTotal.current,
    comparison: operatingIncome.comparison !== undefined
      ? (operatingIncome.comparison || 0) + (otherTotal.comparison || 0)
      : undefined,
  };

  return {
    sections: [
      { title: "Revenue", accounts: revenue, total: revenueTotal },
      { title: "Cost of Services", accounts: costOfServices, total: cosTotal },
      { title: "Operating Expenses", accounts: operatingExpenses, total: opexTotal },
      { title: "Other Income/Expense", accounts: otherIncome, total: otherTotal },
    ],
    grossProfit,
    operatingIncome,
    netIncome,
  };
}

function getDemoPnLData() {
  return {
    sections: [
      {
        title: "Revenue",
        accounts: [
          { accountNo: "4000", title: "Patient Service Revenue", current: 2450000, comparison: 2280000 },
          { accountNo: "4100", title: "Lab & Diagnostic Revenue", current: 285000, comparison: 265000 },
          { accountNo: "4200", title: "Ancillary Services", current: 112500, comparison: 98000 },
        ],
        total: { current: 2847500, comparison: 2643000 },
      },
      {
        title: "Cost of Services",
        accounts: [
          { accountNo: "5000", title: "Medical Supplies", current: 385000, comparison: 365000 },
          { accountNo: "5100", title: "Lab Costs", current: 125000, comparison: 118000 },
          { accountNo: "5200", title: "Direct Labor - Clinical", current: 680000, comparison: 645000 },
        ],
        total: { current: 1190000, comparison: 1128000 },
      },
    ],
    grossProfit: { current: 1657500, comparison: 1515000 },
    operatingIncome: { current: 620500, comparison: 565000 },
    netIncome: { current: 485200, comparison: 425000 },
    isDemo: true,
  };
}
