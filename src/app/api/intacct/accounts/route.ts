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
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const accounts = await client.getGLAccounts(activeOnly);

    return NextResponse.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch accounts",
      },
      { status: 500 }
    );
  }
}
