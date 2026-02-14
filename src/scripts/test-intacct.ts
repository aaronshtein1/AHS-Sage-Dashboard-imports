/**
 * Test script for Sage Intacct API connection
 * Run with: npx ts-node src/scripts/test-intacct.ts
 */

import { parseStringPromise } from "xml2js";

const INTACCT_ENDPOINT = "https://api.intacct.com/ia/xml/xmlgw.phtml";

// Test credentials
const credentials = {
  companyId: "homecare4all",
  userId: "ahsolga",
  password: "Home2026*",
  // These are required for Web Services - you may need to get these from Intacct
  senderId: "", // Your Web Services sender ID
  senderPassword: "", // Your Web Services sender password
};

function buildLoginRequest(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <control>
    <senderid>${credentials.senderId}</senderid>
    <password>${credentials.senderPassword}</password>
    <controlid>${Date.now()}</controlid>
    <uniqueid>false</uniqueid>
    <dtdversion>3.0</dtdversion>
    <includewhitespace>false</includewhitespace>
  </control>
  <operation>
    <authentication>
      <login>
        <userid>${credentials.userId}</userid>
        <companyid>${credentials.companyId}</companyid>
        <password>${credentials.password}</password>
      </login>
    </authentication>
    <content>
      <function controlid="testConnection">
        <getAPISession />
      </function>
    </content>
  </operation>
</request>`;
}

async function testConnection() {
  console.log("Testing Sage Intacct API connection...\n");
  console.log("Company ID:", credentials.companyId);
  console.log("User ID:", credentials.userId);
  console.log("Endpoint:", INTACCT_ENDPOINT);
  console.log("");

  if (!credentials.senderId || !credentials.senderPassword) {
    console.log("⚠️  Web Services Sender ID and Password are required.");
    console.log("");
    console.log("To use the Sage Intacct API, you need:");
    console.log("1. A Web Services subscription in Intacct");
    console.log("2. A Sender ID and Sender Password from Intacct");
    console.log("");
    console.log("You can get these from:");
    console.log("  Intacct → Company → Admin → Web Services");
    console.log("");
    console.log("Once you have them, update the credentials in this file or .env");
    return;
  }

  try {
    const response = await fetch(INTACCT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
      },
      body: buildLoginRequest(),
    });

    const responseText = await response.text();
    console.log("Response status:", response.status);

    // Parse XML response
    const result = await parseStringPromise(responseText);

    // Check for errors
    const status = result?.response?.operation?.[0]?.result?.[0]?.status?.[0];

    if (status === "success") {
      console.log("✅ Connection successful!");
      const sessionId = result?.response?.operation?.[0]?.result?.[0]?.data?.[0]?.api?.[0]?.sessionid?.[0];
      console.log("Session ID:", sessionId?.substring(0, 20) + "...");
    } else {
      const error = result?.response?.operation?.[0]?.result?.[0]?.errormessage;
      console.log("❌ Connection failed");
      console.log("Error:", JSON.stringify(error, null, 2));
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testConnection();
