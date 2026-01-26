/**
 * Sage Intacct API Client
 * Main client for interacting with Sage Intacct Web Services
 */

import {
  buildGetApiSessionRequest,
  buildQueryRequest,
  buildReadByQueryRequest,
  buildLegacyGetAccountBalancesRequest,
  buildGetReportingPeriodsRequest,
  type IntacctCredentials,
  type QueryOptions,
} from "./xml-builder";
import {
  parseIntacctResponse,
  parseSessionResponse,
  extractRecords,
  parseNumericField,
  type IntacctResponse,
  type SessionData,
} from "./xml-parser";
import type {
  IntacctGLAccount,
  IntacctGLBalance,
  IntacctLocation,
  IntacctDepartment,
} from "@/types";

const DEFAULT_ENDPOINT = "https://api.intacct.com/ia/xml/xmlgw.phtml";

interface IntacctClientConfig {
  senderId: string;
  senderPassword: string;
  companyId: string;
  userId: string;
  userPassword: string;
  endpoint?: string;
}

interface SessionInfo {
  sessionId: string;
  endpoint: string;
  expiresAt: Date;
}

export class IntacctClient {
  private config: IntacctClientConfig;
  private session: SessionInfo | null = null;
  private endpoint: string;

  constructor(config: IntacctClientConfig) {
    this.config = config;
    this.endpoint = config.endpoint || DEFAULT_ENDPOINT;
  }

  private getCredentials(): IntacctCredentials {
    return {
      senderId: this.config.senderId,
      senderPassword: this.config.senderPassword,
      companyId: this.config.companyId,
      userId: this.config.userId,
      userPassword: this.config.userPassword,
      sessionId: this.session?.sessionId,
    };
  }

  private async sendRequest(xmlBody: string): Promise<string> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
      },
      body: xmlBody,
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  async getSession(): Promise<SessionData> {
    // Check if we have a valid session
    if (this.session && this.session.expiresAt > new Date()) {
      return {
        sessionId: this.session.sessionId,
        endpoint: this.session.endpoint,
      };
    }

    const request = buildGetApiSessionRequest(this.getCredentials());
    const responseXml = await this.sendRequest(request);
    const response = await parseSessionResponse(responseXml);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to get session");
    }

    // Session typically lasts 1 hour, we'll refresh at 50 minutes
    this.session = {
      sessionId: response.data.sessionId,
      endpoint: response.data.endpoint,
      expiresAt: new Date(Date.now() + 50 * 60 * 1000),
    };

    this.endpoint = response.data.endpoint;

    return response.data;
  }

  async ensureSession(): Promise<void> {
    await this.getSession();
  }

  async query<T>(options: QueryOptions): Promise<T[]> {
    await this.ensureSession();

    const request = buildQueryRequest(this.getCredentials(), options);
    const responseXml = await this.sendRequest(request);
    const response = await parseIntacctResponse<Record<string, unknown>>(responseXml);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Query failed");
    }

    return extractRecords<T>(response.data, options.object);
  }

  async readByQuery<T>(
    object: string,
    query: string,
    fields: string[] = ["*"],
    pageSize: number = 1000
  ): Promise<T[]> {
    await this.ensureSession();

    const request = buildReadByQueryRequest(
      this.getCredentials(),
      object,
      query,
      fields,
      pageSize
    );
    const responseXml = await this.sendRequest(request);
    const response = await parseIntacctResponse<Record<string, unknown>>(responseXml);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Query failed");
    }

    return extractRecords<T>(response.data, object);
  }

  // ==================== GL ACCOUNTS ====================

  async getGLAccounts(activeOnly: boolean = true): Promise<IntacctGLAccount[]> {
    const filters = activeOnly
      ? [{ field: "STATUS", operator: "=" as const, value: "active" }]
      : [];

    return this.query<IntacctGLAccount>({
      object: "GLACCOUNT",
      fields: [
        "RECORDNO",
        "ACCOUNTNO",
        "TITLE",
        "ACCOUNTTYPE",
        "NORMALBALANCE",
        "CLOSINGTYPE",
        "CLOSINGACCOUNTNO",
        "STATUS",
        "CATEGORY",
      ],
      filters,
      orderBy: [{ field: "ACCOUNTNO" }],
      pageSize: 2000,
    });
  }

  // ==================== ACCOUNT BALANCES ====================

  async getAccountBalances(
    periodName: string,
    options: {
      locationId?: string;
      departmentId?: string;
      accountNo?: string;
      showZeroBalances?: boolean;
    } = {}
  ): Promise<IntacctGLBalance[]> {
    await this.ensureSession();

    const request = buildLegacyGetAccountBalancesRequest(this.getCredentials(), {
      reportingPeriodName: periodName,
      locationId: options.locationId,
      departmentId: options.departmentId,
      glAccountNo: options.accountNo,
      showZeroBalances: options.showZeroBalances ?? false,
    });

    const responseXml = await this.sendRequest(request);
    const response = await parseIntacctResponse<Record<string, unknown>>(responseXml);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to get account balances");
    }

    const records = extractRecords<Record<string, unknown>>(response.data, "glaccountbalance");

    return records.map((record) => ({
      RECORDNO: String(record.RECORDNO || ""),
      ACCOUNTNO: String(record.ACCOUNTNO || record.GLACCOUNTNO || ""),
      ACCOUNTTITLE: String(record.ACCOUNTTITLE || record.TITLE || ""),
      LOCATIONID: record.LOCATIONID ? String(record.LOCATIONID) : undefined,
      DEPARTMENTID: record.DEPARTMENTID ? String(record.DEPARTMENTID) : undefined,
      REPORTINGPERIOD: periodName,
      OPENBALANCE: parseNumericField(record.OPENBALANCE || record.BEGINNINGBALANCE),
      DEBITAMOUNT: parseNumericField(record.DEBITAMOUNT || record.TOTALDEBIT),
      CREDITAMOUNT: parseNumericField(record.CREDITAMOUNT || record.TOTALCREDIT),
      ADJDEBITAMOUNT: parseNumericField(record.ADJDEBITAMOUNT || 0),
      ADJCREDITAMOUNT: parseNumericField(record.ADJCREDITAMOUNT || 0),
      ENDBALANCE: parseNumericField(record.ENDBALANCE || record.ENDINGBALANCE),
    }));
  }

  // ==================== REPORTING PERIODS ====================

  async getReportingPeriods(): Promise<
    Array<{
      recordNo: string;
      name: string;
      header: string;
      startDate: string;
      endDate: string;
      isBudgetable: boolean;
    }>
  > {
    await this.ensureSession();

    const request = buildGetReportingPeriodsRequest(this.getCredentials());
    const responseXml = await this.sendRequest(request);
    const response = await parseIntacctResponse<Record<string, unknown>>(responseXml);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to get reporting periods");
    }

    const records = extractRecords<Record<string, unknown>>(response.data, "REPORTINGPERIOD");

    return records.map((record) => ({
      recordNo: String(record.RECORDNO || ""),
      name: String(record.NAME || ""),
      header: String(record.HEADER1 || ""),
      startDate: String(record.START_DATE || ""),
      endDate: String(record.END_DATE || ""),
      isBudgetable: record.BUDGETING === "true" || record.BUDGETING === true,
    }));
  }

  // ==================== LOCATIONS ====================

  async getLocations(): Promise<IntacctLocation[]> {
    return this.query<IntacctLocation>({
      object: "LOCATION",
      fields: ["LOCATIONID", "NAME", "PARENTID", "STATUS"],
      filters: [{ field: "STATUS", operator: "=", value: "active" }],
      orderBy: [{ field: "LOCATIONID" }],
    });
  }

  // ==================== DEPARTMENTS ====================

  async getDepartments(): Promise<IntacctDepartment[]> {
    return this.query<IntacctDepartment>({
      object: "DEPARTMENT",
      fields: ["DEPARTMENTID", "TITLE", "PARENTID", "STATUS"],
      filters: [{ field: "STATUS", operator: "=", value: "active" }],
      orderBy: [{ field: "DEPARTMENTID" }],
    });
  }

  // ==================== GL DETAIL (TRANSACTIONS) ====================

  async getGLDetail(
    startDate: string,
    endDate: string,
    options: {
      accountNo?: string;
      locationId?: string;
      departmentId?: string;
    } = {}
  ): Promise<
    Array<{
      recordNo: string;
      batchNo: string;
      entryNo: string;
      accountNo: string;
      accountTitle: string;
      locationId?: string;
      departmentId?: string;
      trxDate: string;
      trxAmount: number;
      description: string;
      memo?: string;
    }>
  > {
    const conditions: string[] = [
      `ENTRY_DATE >= '${startDate}'`,
      `ENTRY_DATE <= '${endDate}'`,
    ];

    if (options.accountNo) {
      conditions.push(`ACCOUNTNO = '${options.accountNo}'`);
    }
    if (options.locationId) {
      conditions.push(`LOCATIONID = '${options.locationId}'`);
    }
    if (options.departmentId) {
      conditions.push(`DEPARTMENTID = '${options.departmentId}'`);
    }

    const query = conditions.join(" AND ");

    const records = await this.readByQuery<Record<string, unknown>>(
      "GLDETAIL",
      query,
      [
        "RECORDNO",
        "BATCH_NO",
        "ENTRY_NO",
        "ACCOUNTNO",
        "ACCOUNTTITLE",
        "LOCATIONID",
        "DEPARTMENTID",
        "ENTRY_DATE",
        "TRX_AMOUNT",
        "DESCRIPTION",
        "MEMO",
      ],
      2000
    );

    return records.map((record) => ({
      recordNo: String(record.RECORDNO || ""),
      batchNo: String(record.BATCH_NO || ""),
      entryNo: String(record.ENTRY_NO || ""),
      accountNo: String(record.ACCOUNTNO || ""),
      accountTitle: String(record.ACCOUNTTITLE || ""),
      locationId: record.LOCATIONID ? String(record.LOCATIONID) : undefined,
      departmentId: record.DEPARTMENTID ? String(record.DEPARTMENTID) : undefined,
      trxDate: String(record.ENTRY_DATE || ""),
      trxAmount: parseNumericField(record.TRX_AMOUNT),
      description: String(record.DESCRIPTION || ""),
      memo: record.MEMO ? String(record.MEMO) : undefined,
    }));
  }

  // ==================== BUDGETS ====================

  async getBudgets(): Promise<
    Array<{
      recordNo: string;
      budgetId: string;
      description: string;
      status: string;
    }>
  > {
    const records = await this.query<Record<string, unknown>>({
      object: "GLBUDGETHEADER",
      fields: ["RECORDNO", "BUDGETID", "DESCRIPTION", "STATUS"],
      filters: [{ field: "STATUS", operator: "=", value: "active" }],
    });

    return records.map((record) => ({
      recordNo: String(record.RECORDNO || ""),
      budgetId: String(record.BUDGETID || ""),
      description: String(record.DESCRIPTION || ""),
      status: String(record.STATUS || ""),
    }));
  }

  async getBudgetItems(
    budgetId: string,
    periodName?: string
  ): Promise<
    Array<{
      recordNo: string;
      accountNo: string;
      periodName: string;
      locationId?: string;
      departmentId?: string;
      amount: number;
    }>
  > {
    const conditions: string[] = [`BUDGETID = '${budgetId}'`];
    if (periodName) {
      conditions.push(`REPORTINGPERIODNAME = '${periodName}'`);
    }

    const records = await this.readByQuery<Record<string, unknown>>(
      "GLBUDGETITEM",
      conditions.join(" AND "),
      [
        "RECORDNO",
        "ACCOUNTNO",
        "REPORTINGPERIODNAME",
        "LOCATIONID",
        "DEPARTMENTID",
        "AMOUNT",
      ],
      2000
    );

    return records.map((record) => ({
      recordNo: String(record.RECORDNO || ""),
      accountNo: String(record.ACCOUNTNO || ""),
      periodName: String(record.REPORTINGPERIODNAME || ""),
      locationId: record.LOCATIONID ? String(record.LOCATIONID) : undefined,
      departmentId: record.DEPARTMENTID ? String(record.DEPARTMENTID) : undefined,
      amount: parseNumericField(record.AMOUNT),
    }));
  }

  // ==================== TEST CONNECTION ====================

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const session = await this.getSession();
      return {
        success: true,
        message: `Connected successfully. Session endpoint: ${session.endpoint}`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }
}

// Factory function to create client from environment
export function createIntacctClientFromEnv(): IntacctClient | null {
  const senderId = process.env.INTACCT_SENDER_ID;
  const senderPassword = process.env.INTACCT_SENDER_PASSWORD;
  const companyId = process.env.INTACCT_COMPANY_ID;
  const userId = process.env.INTACCT_USER_ID;
  const userPassword = process.env.INTACCT_USER_PASSWORD;

  if (!senderId || !senderPassword || !companyId || !userId || !userPassword) {
    return null;
  }

  return new IntacctClient({
    senderId,
    senderPassword,
    companyId,
    userId,
    userPassword,
    endpoint: process.env.INTACCT_ENDPOINT,
  });
}
