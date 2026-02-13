import { NextRequest, NextResponse } from "next/server";
import {
  intacctAutomation,
  CreditCardTemplate,
} from "@/lib/mcp/intacct-automation";

// POST - Create a new credit card template via browser automation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const template: CreditCardTemplate = body;

    // Validate template structure
    if (!template.name || !template.bankAccountId || !template.defaultGLAccount) {
      return NextResponse.json(
        { error: "Invalid template: name, bankAccountId, and defaultGLAccount are required" },
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

    // Create the template via browser automation
    const result = await intacctAutomation.createCreditCardTemplate(template);

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
    console.error("Create template error:", error);
    return NextResponse.json(
      { error: "Failed to create credit card template" },
      { status: 500 }
    );
  }
}
