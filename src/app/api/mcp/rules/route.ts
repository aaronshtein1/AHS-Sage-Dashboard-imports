import { NextRequest, NextResponse } from "next/server";
import {
  intacctAutomation,
  MatchingRule,
} from "@/lib/mcp/intacct-automation";

// POST - Create a new matching rule via browser automation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rule: MatchingRule = body;

    // Validate rule structure
    if (!rule.name || !rule.conditions?.length || !rule.actions?.length) {
      return NextResponse.json(
        { error: "Invalid rule: name, conditions, and actions are required" },
        { status: 400 }
      );
    }

    // Check if logged in
    if (!intacctAutomation.isAuthenticated()) {
      return NextResponse.json(
        { error: "Not logged in. Please login to Intacct first." },
        { status: 401 }
      );
    }

    // Create the rule via browser automation
    const result = await intacctAutomation.createMatchingRule(rule);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        screenshot: result.screenshot,
      });
    } else {
      return NextResponse.json(
        { error: result.error || result.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Create rule error:", error);
    return NextResponse.json(
      { error: "Failed to create matching rule" },
      { status: 500 }
    );
  }
}
