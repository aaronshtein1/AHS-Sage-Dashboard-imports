import { NextRequest, NextResponse } from "next/server";
import { IntacctClient } from "@/lib/intacct/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, userId, userPassword, senderId, senderPassword } = body;

    if (!companyId || !userId || !userPassword || !senderId || !senderPassword) {
      return NextResponse.json(
        { success: false, error: "Missing required credentials" },
        { status: 400 }
      );
    }

    const client = new IntacctClient({
      companyId,
      userId,
      userPassword,
      senderId,
      senderPassword,
    });

    const result = await client.testConnection();

    if (result.success) {
      // TODO: Store credentials securely in database
      return NextResponse.json({
        success: true,
        message: result.message,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Connection error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      },
      { status: 500 }
    );
  }
}
