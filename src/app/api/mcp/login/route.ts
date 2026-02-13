import { NextRequest, NextResponse } from "next/server";
import { intacctAutomation } from "@/lib/mcp/intacct-automation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, userId, password } = body;

    if (!companyId || !userId || !password) {
      return NextResponse.json(
        { error: "Missing required credentials" },
        { status: 400 }
      );
    }

    const result = await intacctAutomation.login({
      companyId,
      userId,
      password,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        screenshot: result.screenshot,
      });
    } else {
      return NextResponse.json(
        { error: result.error || result.message },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("MCP login error:", error);
    return NextResponse.json(
      { error: "Failed to perform login automation" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    authenticated: intacctAutomation.isAuthenticated(),
  });
}
