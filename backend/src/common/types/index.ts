/**
 * Common types shared across the application
 */

export interface OrgContext {
  orgId: string;
  userId: string;
  role: 'admin' | 'accountant' | 'viewer';
}

// ========== WS2: Auth Types ==========

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    orgs: { id: string; name: string; role: string }[];
  };
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  currentOrgId?: string; // selected org context
  iat?: number;
  exp?: number;
}

export interface JwtPayloadWithOrg extends JwtPayload {
  currentOrgId: string;
  role: 'admin' | 'accountant' | 'viewer';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// Decimal is serialized as string from Prisma
export type DecimalString = string;

// Common API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Journal line input for creating/updating
export interface JournalLineInput {
  accountId: string;
  debitAmount?: string | null;
  creditAmount?: string | null;
  memo?: string;
  dimensions?: {
    dimensionTypeId: string;
    dimensionValueId: string;
  }[];
}

// Trial Balance row
export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountTitle: string;
  accountType: string;
  normalBalance: string;
  debitBalance: string;
  creditBalance: string;
}

// Trial Balance report
export interface TrialBalanceReport {
  asOfDate: string;
  generatedAt: string;
  rows: TrialBalanceRow[];
  totals: {
    totalDebits: string;
    totalCredits: string;
    difference: string;
  };
}
