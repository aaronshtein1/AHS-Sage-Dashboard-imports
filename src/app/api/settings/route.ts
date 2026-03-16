import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// Simple encryption for storing sensitive data (in production, use a proper secrets manager)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-dev-key-change-in-prod!!";

function encrypt(text: string): string {
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

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

const SETTINGS_FILE = path.join(process.cwd(), ".intacct-settings.json");

interface Settings {
  companyId: string;
  userId: string;
  userPassword: string;
  senderId: string;
  senderPassword: string;
  fiscalYearStartMonth: string;
  defaultLocation: string;
  autoSyncEnabled: boolean;
  syncInterval: string;
}

async function loadSettings(): Promise<Partial<Settings>> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, "utf-8");
    const settings = JSON.parse(data);

    // Decrypt sensitive fields
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

async function saveSettings(settings: Partial<Settings>): Promise<void> {
  // Encrypt sensitive fields before saving
  const toSave = { ...settings };
  if (toSave.userPassword) {
    toSave.userPassword = encrypt(toSave.userPassword);
  }
  if (toSave.senderPassword) {
    toSave.senderPassword = encrypt(toSave.senderPassword);
  }

  await fs.writeFile(SETTINGS_FILE, JSON.stringify(toSave, null, 2));
}

export async function GET() {
  try {
    const settings = await loadSettings();

    // Don't send actual passwords to client - just indicate if they're set
    const safeSettings = {
      ...settings,
      userPassword: settings.userPassword ? "••••••••" : "",
      senderPassword: settings.senderPassword ? "••••••••" : "",
      hasCredentials: !!(settings.companyId && settings.userId && settings.senderId),
    };

    return NextResponse.json({ success: true, settings: safeSettings });
  } catch (error) {
    console.error("Error loading settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentSettings = await loadSettings();

    // Merge with existing settings, only update provided fields
    const newSettings: Partial<Settings> = {
      ...currentSettings,
    };

    // Only update fields that are provided and not placeholder values
    if (body.companyId !== undefined) newSettings.companyId = body.companyId;
    if (body.userId !== undefined) newSettings.userId = body.userId;
    if (body.senderId !== undefined) newSettings.senderId = body.senderId;
    if (body.fiscalYearStartMonth !== undefined) newSettings.fiscalYearStartMonth = body.fiscalYearStartMonth;
    if (body.defaultLocation !== undefined) newSettings.defaultLocation = body.defaultLocation;
    if (body.autoSyncEnabled !== undefined) newSettings.autoSyncEnabled = body.autoSyncEnabled;
    if (body.syncInterval !== undefined) newSettings.syncInterval = body.syncInterval;

    // Only update passwords if they're not the placeholder
    if (body.userPassword && body.userPassword !== "••••••••") {
      newSettings.userPassword = body.userPassword;
    }
    if (body.senderPassword && body.senderPassword !== "••••••••") {
      newSettings.senderPassword = body.senderPassword;
    }

    await saveSettings(newSettings);

    return NextResponse.json({
      success: true,
      message: "Settings saved successfully",
    });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
