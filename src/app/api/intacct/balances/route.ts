import { NextRequest, NextResponse } from "next/server";
import { createIntacctClientFromEnv } from "@/lib/intacct/client";

export async function GET(request: NextRequest) {
  try {
    const client = createIntacctClientFromEnv();

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Intacct not configured" },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period");
    const locationId = searchParams.get("locationId") || undefined;
    const departmentId = searchParams.get("departmentId") || undefined;
    const accountNo = searchParams.get("accountNo") || undefined;

    if (!period) {
      return NextResponse.json(
        { success: false, error: "Period parameter is required" },
        { status: 400 }
      );
    }

    const balances = await client.getAccountBalances(period, {
      locationId,
      departmentId,
      accountNo,
    });

    return NextResponse.json({
      success: true,
      data: balances,
      period,
      count: balances.length,
    });
  } catch (error) {
    console.error("Error fetching balances:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch balances",
      },
      { status: 500 }
    );
  }
}
