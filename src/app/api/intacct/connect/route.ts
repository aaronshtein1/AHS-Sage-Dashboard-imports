import { NextRequest, NextResponse } from "next/server";
import { IntacctClient } from "@/lib/intacct/client";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-dev-key-change-in-prod!!";
const SETTINGS_FILE = path.join(process.cwd(), ".intacct-settings.json");

function decrypt(text: string): string {
  try {
    const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
    const [ivHex, encrypted] = text.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "";
  }
}

async function loadStoredSettings(): Promise<Record<string, string>> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, "utf-8");
    const settings = JSON.parse(data);
    // Decrypt passwords
    if (settings.userPassword) {
      settings.userPassword = decrypt(settings.userPassword);
    }
    if (settings.senderPassword) {
      settings.senderPassword = decrypt(settings.senderPassword);
    }
    return settings;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { companyId, userId, userPassword, senderId, senderPassword } = body;

    // If passwords are masked, load from stored settings
    if (userPassword === "••••••••" || senderPassword === "••••••••") {
      const stored = await loadStoredSettings();
      if (userPassword === "••••••••" && stored.userPassword) {
        userPassword = stored.userPassword;
      }
      if (senderPassword === "••••••••" && stored.senderPassword) {
        senderPassword = stored.senderPassword;
      }
    }

    // Check for missing fields and provide specific error
    const missingFields: string[] = [];
    if (!companyId) missingFields.push("Company ID");
    if (!userId) missingFields.push("User ID");
    if (!userPassword || userPassword === "••••••••") missingFields.push("User Password (please re-enter)");
    if (!senderId) missingFields.push("Sender ID");
    if (!senderPassword || senderPassword === "••••••••") missingFields.push("Sender Password (please re-enter)");

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required credentials: ${missingFields.join(", ")}. Please fill in all fields.`
        },
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
      return NextResponse.json({
        success: true,
        message: result.message,
      });
    } else {
      // Provide more helpful error messages
      let errorMessage = result.message;

      if (errorMessage.includes("Invalid credentials") || errorMessage.includes("authentication")) {
        errorMessage += ". Please verify your User ID and User Password are correct.";
      } else if (errorMessage.includes("sender") || errorMessage.includes("Sender")) {
        errorMessage += ". Please verify your Sender ID and Sender Password from Web Services authorization.";
      } else if (errorMessage.includes("company") || errorMessage.includes("Company")) {
        errorMessage += ". Please verify your Company ID is correct.";
      }

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Connection error:", error);

    let errorMessage = error instanceof Error ? error.message : "Connection failed";

    // Add helpful context to common errors
    if (errorMessage.includes("400")) {
      errorMessage = "Bad Request - The Sender ID or Sender Password may be incorrect. These are from your Web Services subscription, not your user login.";
    } else if (errorMessage.includes("401")) {
      errorMessage = "Authentication failed - Please check your User ID and User Password.";
    } else if (errorMessage.includes("403")) {
      errorMessage = "Access denied - Your Web Services user may not have the required permissions.";
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
