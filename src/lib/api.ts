import type {
  User,
  LoginRequest,
  LoginResponse,
  Account,
  CreateAccountRequest,
  DimensionType,
  DimensionValue,
  JournalType,
  JournalEntry,
  CreateJournalRequest,
  TrialBalanceReport,
  TrialBalanceRow,
  BalanceSheetReport,
  ProfitLossReport,
  AccountingPeriod,
  PaginatedResponse,
  PlaidLinkToken,
  PlaidItem,
  PlaidSyncResult,
  BankTransaction,
  ReconciliationSession,
  CreateReconciliationSessionRequest,
  CreateReconMatchRequest,
  ReconciliationSummary,
  ReportDefinition,
  GeneratedReport,
  CustomReportDefinition,
  GeneratedCustomReport,
  DrillThroughTransaction,
  RuleSuggestion,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3019/api';
const USE_MOCK_DATA = false; // Set to true for mock data, false for real backend

// ==================== MOCK DATA ====================

const mockUser: User = {
  id: '1',
  email: 'admin@example.com',
  name: 'Admin User',
  currentOrgId: 'org1',
  orgs: [
    { id: 'org1', name: 'At Home Solutions LLC', role: 'admin' },
  ],
};

const mockAccounts: Account[] = [
  {
    id: 'acc1',
    accountCode: '1001',
    title: 'Cash - Operating',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    status: 'ACTIVE',
    closingType: 'NON_CLOSING',
    category: 'Current Assets',
    requiredDimensions: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'acc2',
    accountCode: '1200',
    title: 'Accounts Receivable',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    status: 'ACTIVE',
    closingType: 'NON_CLOSING',
    category: 'Current Assets',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'acc3',
    accountCode: '4000',
    title: 'Patient Services Revenue',
    accountType: 'REVENUE',
    normalBalance: 'CREDIT',
    status: 'ACTIVE',
    closingType: 'CLOSING',
    category: 'Operating Revenue',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'acc4',
    accountCode: '5000',
    title: 'Salaries Expense',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    status: 'ACTIVE',
    closingType: 'CLOSING',
    category: 'Operating Expenses',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
];

const mockDimensionTypes: DimensionType[] = [
  { id: 'dt1', code: 'LOCATION', name: 'Location', status: 'active' },
  { id: 'dt2', code: 'DEPARTMENT', name: 'Department', status: 'active' },
  { id: 'dt3', code: 'CLASS', name: 'Class', status: 'active' },
];

const mockDimensionValues: DimensionValue[] = [
  { id: 'dv1', dimensionTypeId: 'dt1', dimensionTypeCode: 'LOCATION', code: 'LOC01', name: 'Main Hospital', status: 'active' },
  { id: 'dv2', dimensionTypeId: 'dt1', dimensionTypeCode: 'LOCATION', code: 'LOC02', name: 'Clinic A', status: 'active' },
  { id: 'dv3', dimensionTypeId: 'dt2', dimensionTypeCode: 'DEPARTMENT', code: 'DEPT01', name: 'Emergency', status: 'active' },
  { id: 'dv4', dimensionTypeId: 'dt2', dimensionTypeCode: 'DEPARTMENT', code: 'DEPT02', name: 'Surgery', status: 'active' },
];

const mockJournalTypes: JournalType[] = [
  { id: 'jt1', code: 'GJ', name: 'General Journal' },
  { id: 'jt2', code: 'CD', name: 'Cash Disbursements' },
  { id: 'jt3', code: 'CR', name: 'Cash Receipts' },
  { id: 'jt4', code: 'ADJ', name: 'Adjusting Entry' },
];

let mockJournalEntries: JournalEntry[] = [
  {
    id: 'je1',
    entryDate: '2025-01-15',
    postingDate: '2025-01-15',
    referenceNumber: 'GJ-001',
    description: 'Initial cash deposit',
    status: 'posted',
    journalType: mockJournalTypes[0],
    lines: [
      {
        id: 'jl1',
        accountId: 'acc1',
        accountNo: '1001',
        accountTitle: 'Cash - Operating',
        debit: 10000,
        credit: 0,
        dimensions: [],
      },
      {
        id: 'jl2',
        accountId: 'acc3',
        accountNo: '4000',
        accountTitle: 'Patient Services Revenue',
        debit: 0,
        credit: 10000,
        dimensions: [
          { dimensionTypeCode: 'LOCATION', dimensionValueCode: 'LOC01', dimensionValueName: 'Main Hospital' },
          { dimensionTypeCode: 'DEPARTMENT', dimensionValueCode: 'DEPT01', dimensionValueName: 'Emergency' },
        ],
      },
    ],
    createdAt: '2025-01-15T10:00:00Z',
    postedAt: '2025-01-15T10:05:00Z',
    postedBy: 'admin@example.com',
    createdBy: 'admin@example.com',
  },
  {
    id: 'je2',
    entryDate: '2025-01-20',
    postingDate: null,
    referenceNumber: 'GJ-002',
    description: 'Salary accrual',
    status: 'draft',
    journalType: mockJournalTypes[0],
    lines: [
      {
        id: 'jl3',
        accountId: 'acc4',
        accountNo: '5000',
        accountTitle: 'Salaries Expense',
        debit: 5000,
        credit: 0,
        dimensions: [
          { dimensionTypeCode: 'LOCATION', dimensionValueCode: 'LOC01', dimensionValueName: 'Main Hospital' },
          { dimensionTypeCode: 'DEPARTMENT', dimensionValueCode: 'DEPT01', dimensionValueName: 'Emergency' },
        ],
      },
      {
        id: 'jl4',
        accountId: 'acc1',
        accountNo: '1001',
        accountTitle: 'Cash - Operating',
        debit: 0,
        credit: 5000,
        dimensions: [],
      },
    ],
    createdAt: '2025-01-20T14:00:00Z',
    postedAt: null,
    postedBy: null,
    createdBy: 'admin@example.com',
  },
];

const mockPeriods: AccountingPeriod[] = [
  { id: 'p1', name: 'January 2025', startDate: '2025-01-01', endDate: '2025-01-31', status: 'open', fiscalYear: 2025 },
  { id: 'p2', name: 'December 2024', startDate: '2024-12-01', endDate: '2024-12-31', status: 'closed', fiscalYear: 2024 },
];

// ==================== API CLIENT ====================

class ApiClient {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (USE_MOCK_DATA) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      throw new Error('Mock mode: use mock methods instead');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;

      // Extract org and user info from JWT token and add as headers for backend
      // Only attempt to parse if token looks like a valid JWT (has 3 parts)
      const tokenParts = this.token.split('.');
      if (tokenParts.length === 3) {
        try {
          const payload = JSON.parse(atob(tokenParts[1]));
          if (payload.currentOrgId) {
            headers['x-org-id'] = payload.currentOrgId;
          }
          if (payload.sub) {
            headers['x-user-id'] = payload.sub;
          }
        } catch (e) {
          // If token parsing fails, continue without headers
          console.warn('Failed to parse JWT token:', e);
        }
      }
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // ==================== AUTH ====================

  async login(data: LoginRequest): Promise<LoginResponse> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Simple mock validation
      if (data.email === 'admin@example.com' && data.password === 'password') {
        const response: LoginResponse = {
          accessToken: 'mock-jwt-token-' + Date.now(),
          user: mockUser,
        };
        this.setToken(response.accessToken);
        return response;
      }
      throw new Error('Invalid credentials');
    }
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // Store the access token
    this.setToken(response.accessToken);
    return response;
  }

  async logout(): Promise<void> {
    this.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('current_org_id');
    }
  }

  async getCurrentUser(): Promise<User> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      // In mock mode, auto-authenticate for easier testing
      if (!this.token) {
        this.setToken('mock-jwt-token-auto');
      }
      return mockUser;
    }

    // If no token, throw immediately instead of making a request
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    // If token looks like a mock token, clear it and throw
    if (this.token.startsWith('mock-')) {
      this.setToken(null);
      throw new Error('Invalid token');
    }

    return this.request<User>('/auth/me');
  }

  async selectOrg(orgId: string): Promise<{ accessToken: string }> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (typeof window !== 'undefined') {
        localStorage.setItem('current_org_id', orgId);
      }
      mockUser.currentOrgId = orgId;
      return { accessToken: 'mock-token' };
    }
    const response = await this.request<{ accessToken: string }>(`/orgs/${orgId}/select`, { method: 'PUT' });
    // Update stored token with the new one that includes currentOrgId
    this.setToken(response.accessToken);
    return response;
  }

  // ==================== ACCOUNTS ====================

  async getAccounts(): Promise<Account[]> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return [...mockAccounts];
    }
    return this.request<Account[]>('/accounts');
  }

  async createAccount(data: CreateAccountRequest): Promise<Account> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const newAccount: Account = {
        id: 'acc' + (mockAccounts.length + 1),
        ...data,
        status: 'ACTIVE',
        requiredDimensions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockAccounts.push(newAccount);
      return newAccount;
    }
    return this.request<Account>('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccount(id: string, data: Partial<CreateAccountRequest>): Promise<Account> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const index = mockAccounts.findIndex((a) => a.id === id);
      if (index === -1) throw new Error('Account not found');
      mockAccounts[index] = {
        ...mockAccounts[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      return mockAccounts[index];
    }
    return this.request<Account>(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ==================== DIMENSIONS ====================

  async getDimensionTypes(): Promise<DimensionType[]> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return [...mockDimensionTypes];
    }
    return this.request<DimensionType[]>('/accounts/dimensions/types');
  }

  async getDimensionValues(dimensionTypeCode?: string): Promise<DimensionValue[]> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (dimensionTypeCode) {
        return mockDimensionValues.filter((dv) => dv.dimensionTypeCode === dimensionTypeCode);
      }
      return [...mockDimensionValues];
    }
    const query = dimensionTypeCode ? `?dimensionTypeCode=${dimensionTypeCode}` : '';
    return this.request<DimensionValue[]>(`/accounts/dimensions/values${query}`);
  }

  // ==================== JOURNALS ====================

  async getJournalTypes(): Promise<JournalType[]> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return [...mockJournalTypes];
    }
    return this.request<JournalType[]>('/journals/types');
  }

  async createJournalType(data: { code: string; name: string; description?: string }): Promise<JournalType> {
    return this.request<JournalType>('/journals/types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateJournalType(id: string, data: { name?: string; description?: string }): Promise<JournalType> {
    return this.request<JournalType>(`/journals/types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteJournalType(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/journals/types/${id}`, {
      method: 'DELETE',
    });
  }

  // Transform backend journal response to frontend format
  private transformJournalResponse(backendJournal: any): JournalEntry {
    // Helper to format date as YYYY-MM-DD
    const formatDate = (date: string | null | undefined): string => {
      if (!date) return '';
      // If it's a full ISO datetime, extract just the date part
      return date.split('T')[0];
    };

    return {
      ...backendJournal,
      // Ensure dates are in YYYY-MM-DD format for form inputs
      entryDate: formatDate(backendJournal.entryDate),
      postingDate: backendJournal.postingDate ? formatDate(backendJournal.postingDate) : null,
      // Backend uses 'reference', frontend uses 'referenceNumber'
      referenceNumber: backendJournal.reference || backendJournal.referenceNumber || backendJournal.entryNumber || '',
      // Transform lines if present
      lines: backendJournal.lines?.map((line: any) => ({
        ...line,
        // Backend uses debitAmount/creditAmount, frontend uses debit/credit
        debit: parseFloat(line.debitAmount) || line.debit || 0,
        credit: parseFloat(line.creditAmount) || line.credit || 0,
        // Backend uses 'description', frontend also uses 'description' - should match
        description: line.description || line.memo || '',
        // Map account info for display
        accountNo: line.account?.accountCode || line.accountNo || '',
        accountTitle: line.account?.title || line.accountTitle || '',
      })) || [],
    };
  }

  async getJournals(filters?: { status?: string; journalTypeId?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<{ data: JournalEntry[]; total: number; page: number; pageSize: number; totalPages: number }> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      let filtered = [...mockJournalEntries];
      if (filters?.status) {
        filtered = filtered.filter((j) => j.status === filters.status);
      }
      if (filters?.journalTypeId) {
        filtered = filtered.filter((j) => j.journalType.id === filters.journalTypeId);
      }
      const page = filters?.page || 1;
      const pageSize = filters?.pageSize || 50;
      const start = (page - 1) * pageSize;
      const paged = filtered.slice(start, start + pageSize);
      return {
        data: paged,
        total: filtered.length,
        page,
        pageSize,
        totalPages: Math.ceil(filtered.length / pageSize),
      };
    }
    const params: Record<string, string> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.journalTypeId) params.journalTypeId = filters.journalTypeId;
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    if (filters?.page) params.page = String(filters.page);
    if (filters?.pageSize) params.pageSize = String(filters.pageSize);
    const query = new URLSearchParams(params).toString();
    const result = await this.request<{ data: any[]; total: number; page: number; pageSize: number; totalPages: number }>(`/journals${query ? `?${query}` : ''}`);
    // Transform backend response to frontend format
    return {
      data: (result.data || []).map((j) => this.transformJournalResponse(j)),
      total: result.total || 0,
      page: result.page || 1,
      pageSize: result.pageSize || 50,
      totalPages: result.totalPages || 1,
    };
  }

  async getJournal(id: string): Promise<JournalEntry> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const journal = mockJournalEntries.find((j) => j.id === id);
      if (!journal) throw new Error('Journal not found');
      return journal;
    }
    const result = await this.request<any>(`/journals/${id}`);
    return this.transformJournalResponse(result);
  }

  async createJournal(data: CreateJournalRequest): Promise<JournalEntry> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const journalType = mockJournalTypes.find((jt) => jt.id === data.journalTypeId);
      if (!journalType) throw new Error('Journal type not found');

      const newJournal: JournalEntry = {
        id: 'je' + (mockJournalEntries.length + 1),
        entryDate: data.entryDate,
        postingDate: null,
        referenceNumber: data.referenceNumber,
        description: data.description,
        status: 'draft',
        journalType,
        lines: data.lines.map((line, index) => {
          const account = mockAccounts.find((a) => a.id === line.accountId);
          return {
            id: 'jl' + Date.now() + index,
            accountId: line.accountId,
            accountNo: account?.accountNo || '',
            accountTitle: account?.title || '',
            debit: line.debit,
            credit: line.credit,
            description: line.description,
            dimensions: (line.dimensions || []).map((dim) => {
              const dimValue = mockDimensionValues.find((dv) => dv.code === dim.dimensionValueCode);
              return {
                dimensionTypeCode: dim.dimensionTypeCode,
                dimensionValueCode: dim.dimensionValueCode,
                dimensionValueName: dimValue?.name || '',
              };
            }),
          };
        }),
        createdAt: new Date().toISOString(),
        postedAt: null,
        postedBy: null,
        createdBy: mockUser.email,
      };
      mockJournalEntries.push(newJournal);
      return newJournal;
    }

    // Transform frontend format to backend format
    const backendPayload = {
      journalTypeId: data.journalTypeId,
      entryDate: data.entryDate,
      description: data.description,
      referenceNumber: data.referenceNumber || undefined,
      lines: data.lines.map((line) => ({
        accountId: line.accountId,
        debitAmount: line.debit > 0 ? String(line.debit) : undefined,
        creditAmount: line.credit > 0 ? String(line.credit) : undefined,
        memo: line.description || undefined,
        // Note: dimensions need dimensionTypeId and dimensionValueId, not codes
        // For now, we'll skip dimensions since we need to look up IDs
        dimensions: undefined,
      })),
    };

    const result = await this.request<any>('/journals', {
      method: 'POST',
      body: JSON.stringify(backendPayload),
    });
    return this.transformJournalResponse(result);
  }

  async postJournal(id: string): Promise<JournalEntry> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const journal = mockJournalEntries.find((j) => j.id === id);
      if (!journal) throw new Error('Journal not found');
      if (journal.status === 'posted') throw new Error('Journal already posted');

      // Validate debit/credit balance
      const totalDebit = journal.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = journal.lines.reduce((sum, line) => sum + line.credit, 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error('Journal is not balanced');
      }

      journal.status = 'posted';
      journal.postingDate = new Date().toISOString().split('T')[0];
      journal.postedAt = new Date().toISOString();
      journal.postedBy = mockUser.email;
      return journal;
    }
    const result = await this.request<any>(`/journals/${id}/post`, { method: 'POST' });
    return this.transformJournalResponse(result);
  }

  async unpostJournal(id: string): Promise<JournalEntry> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const journal = mockJournalEntries.find((j) => j.id === id);
      if (!journal) throw new Error('Journal not found');
      if (journal.status === 'draft') throw new Error('Journal is not posted');

      // Reverse the posting - set back to draft
      journal.status = 'draft';
      journal.postingDate = null;
      journal.postedAt = null;
      journal.postedBy = null;
      return journal;
    }
    const result = await this.request<any>(`/journals/${id}/unpost`, { method: 'POST' });
    return this.transformJournalResponse(result);
  }

  async updateJournal(id: string, data: CreateJournalRequest): Promise<JournalEntry> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const index = mockJournalEntries.findIndex((j) => j.id === id);
      if (index === -1) throw new Error('Journal not found');
      if (mockJournalEntries[index].status === 'posted') throw new Error('Cannot edit posted journal');

      const journalType = mockJournalTypes.find((jt) => jt.id === data.journalTypeId);
      if (!journalType) throw new Error('Journal type not found');

      mockJournalEntries[index] = {
        ...mockJournalEntries[index],
        entryDate: data.entryDate,
        referenceNumber: data.referenceNumber,
        description: data.description,
        journalType,
        lines: data.lines.map((line, idx) => {
          const account = mockAccounts.find((a) => a.id === line.accountId);
          return {
            id: 'jl' + Date.now() + idx,
            accountId: line.accountId,
            accountNo: account?.accountNo || '',
            accountTitle: account?.title || '',
            debit: line.debit,
            credit: line.credit,
            description: line.description,
            dimensions: [],
          };
        }),
      };
      return mockJournalEntries[index];
    }

    // Transform frontend format to backend format
    const backendPayload = {
      entryDate: data.entryDate,
      description: data.description,
      referenceNumber: data.referenceNumber || undefined,
      lines: data.lines.map((line) => ({
        accountId: line.accountId,
        debitAmount: line.debit > 0 ? String(line.debit) : undefined,
        creditAmount: line.credit > 0 ? String(line.credit) : undefined,
        memo: line.description || undefined,
      })),
    };

    const result = await this.request<any>(`/journals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(backendPayload),
    });
    return this.transformJournalResponse(result);
  }

  async deleteJournal(id: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const index = mockJournalEntries.findIndex((j) => j.id === id);
      if (index === -1) throw new Error('Journal not found');
      if (mockJournalEntries[index].status === 'posted') throw new Error('Cannot delete posted journal');
      mockJournalEntries.splice(index, 1);
      return;
    }

    await this.request<{ success: boolean }>(`/journals/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteAllDraftJournals(): Promise<{ success: boolean; deleted: number }> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const draftCount = mockJournalEntries.filter((j) => j.status === 'draft').length;
      // Remove all draft entries
      for (let i = mockJournalEntries.length - 1; i >= 0; i--) {
        if (mockJournalEntries[i].status === 'draft') {
          mockJournalEntries.splice(i, 1);
        }
      }
      return { success: true, deleted: draftCount };
    }

    return this.request<{ success: boolean; deleted: number }>('/journals', {
      method: 'DELETE',
    });
  }

  // ==================== REPORTS ====================

  async getTrialBalance(asOfDate: string): Promise<TrialBalanceReport> {
    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      // Calculate balances from posted journals
      const postedJournals = mockJournalEntries.filter(
        (j) => j.status === 'posted' && j.postingDate && j.postingDate <= asOfDate
      );

      const balances = new Map<string, { debit: number; credit: number }>();
      postedJournals.forEach((journal) => {
        journal.lines.forEach((line) => {
          const existing = balances.get(line.accountId) || { debit: 0, credit: 0 };
          balances.set(line.accountId, {
            debit: existing.debit + line.debit,
            credit: existing.credit + line.credit,
          });
        });
      });

      const rows: TrialBalanceRow[] = mockAccounts.map((account) => {
        const balance = balances.get(account.id) || { debit: 0, credit: 0 };
        return {
          accountId: account.id,
          accountCode: account.accountCode || '',
          accountTitle: account.title,
          accountType: account.accountType,
          normalBalance: account.normalBalance,
          debitBalance: balance.debit.toFixed(2),
          creditBalance: balance.credit.toFixed(2),
        };
      });

      const totalDebit = rows.reduce((sum, row) => sum + parseFloat(row.debitBalance), 0);
      const totalCredit = rows.reduce((sum, row) => sum + parseFloat(row.creditBalance), 0);

      return {
        asOfDate,
        orgId: mockUser.currentOrgId || '',
        orgName: mockUser.orgs.find((o) => o.id === mockUser.currentOrgId)?.name || '',
        rows,
        totals: {
          totalDebit,
          totalCredit,
        },
      };
    }
    return this.request<TrialBalanceReport>(`/reports/trial-balance?asOfDate=${asOfDate}`);
  }

  async getPeriods(): Promise<AccountingPeriod[]> {
    // TODO: Backend periods endpoint not implemented yet - using mock data
    await new Promise((resolve) => setTimeout(resolve, 200));
    return [...mockPeriods];
  }

  // ==================== PLAID / BANK FEEDS ====================

  async createPlaidLinkToken(): Promise<PlaidLinkToken> {
    return this.request<PlaidLinkToken>('/plaid/link-token', {
      method: 'POST',
    });
  }

  async exchangePlaidPublicToken(publicToken: string): Promise<{ plaidItem: PlaidItem; accounts: PlaidItem['accounts'] }> {
    return this.request<{ plaidItem: PlaidItem; accounts: PlaidItem['accounts'] }>('/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({ publicToken }),
    });
  }

  async getPlaidAccounts(): Promise<PlaidItem[]> {
    return this.request<PlaidItem[]>('/plaid/accounts');
  }

  async syncPlaidTransactions(plaidItemId?: string): Promise<PlaidSyncResult> {
    return this.request<PlaidSyncResult>('/plaid/sync', {
      method: 'POST',
      body: JSON.stringify(plaidItemId ? { plaidItemId } : {}),
    });
  }

  async disconnectPlaidAccount(plaidItemId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/plaid/accounts/${plaidItemId}`, {
      method: 'DELETE',
    });
  }

  async getBankTransactions(statusOrFilters?: string | { startDate?: string; endDate?: string; accountId?: string; plaidAccountId?: string; unlinked?: boolean; status?: string; pageSize?: number }): Promise<BankTransaction[]> {
    const params: Record<string, string> = { pageSize: '500' }; // Default to 500 transactions

    if (typeof statusOrFilters === 'string' && statusOrFilters !== 'all') {
      // Map frontend status values to backend enum values
      const statusMap: Record<string, string> = {
        'unmatched': 'PENDING',
        'matched': 'MATCHED',
        'categorized': 'CATEGORIZED',
        'posted': 'POSTED',
      };
      params.status = statusMap[statusOrFilters] || statusOrFilters.toUpperCase();
    } else if (typeof statusOrFilters === 'object' && statusOrFilters) {
      Object.assign(params, statusOrFilters);
      if (params.status && params.status !== 'all') {
        const statusMap: Record<string, string> = {
          'unmatched': 'PENDING',
          'matched': 'MATCHED',
          'categorized': 'CATEGORIZED',
          'posted': 'POSTED',
        };
        params.status = statusMap[params.status] || params.status.toUpperCase();
      }
    }

    const query = new URLSearchParams(params).toString();
    // Backend returns paginated response { data: [...], total, page, ... }
    const response = await this.request<{ data: BankTransaction[]; total: number }>(`/bank/transactions?${query}`);
    return response.data || [];
  }

  async updateTransaction(transactionId: string, data: { accountId?: string; memo?: string; status?: string }): Promise<BankTransaction> {
    return this.request<BankTransaction>(`/bank/transactions/${transactionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async matchTransaction(transactionId: string): Promise<void> {
    return this.request<void>(`/bank/transactions/${transactionId}/match`, {
      method: 'POST',
    });
  }

  async matchTransactionBatch(transactionIds: string[]): Promise<{ matched: number; failed: number }> {
    return this.request<{ matched: number; failed: number }>('/bank/transactions/batch-match', {
      method: 'POST',
      body: JSON.stringify({ transactionIds }),
    });
  }

  async postTransaction(transactionId: string): Promise<{ journalId: string }> {
    return this.request<{ journalId: string }>(`/bank/transactions/${transactionId}/post`, {
      method: 'POST',
    });
  }

  async postTransactionBatch(transactionIds: string[]): Promise<{ posted: number; failed: number; journalIds: string[] }> {
    return this.request<{ posted: number; failed: number; journalIds: string[] }>('/bank/transactions/batch-post', {
      method: 'POST',
      body: JSON.stringify({ transactionIds }),
    });
  }

  async categorizeTransaction(transactionId: string, accountId: string): Promise<BankTransaction> {
    return this.request<BankTransaction>(`/bank/transactions/${transactionId}/categorize`, {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    });
  }

  async createJournalFromTransaction(transactionId: string, data: {
    debitAccountId: string;
    creditAccountId: string;
    description?: string;
  }): Promise<JournalEntry> {
    return this.request<JournalEntry>(`/bank/transactions/${transactionId}/create-journal`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async importBankTransactions(data: { transactions: Array<{ date: string; name: string; amount: number }> }): Promise<{ imported: number }> {
    return this.request<{ imported: number }>('/bank/transactions/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== BANK FEED RULES ====================

  async getBankFeedRules(): Promise<any[]> {
    return this.request<any[]>('/bank/rules');
  }

  async createBankFeedRule(data: any): Promise<any> {
    return this.request<any>('/bank/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBankFeedRule(id: string, data: any): Promise<any> {
    return this.request<any>(`/bank/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBankFeedRule(id: string): Promise<void> {
    return this.request<void>(`/bank/rules/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== AI RULE SUGGESTIONS ====================

  async getRuleSuggestions(limit?: number): Promise<RuleSuggestion[]> {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<RuleSuggestion[]>(`/bank/suggestions${query}`);
  }

  async analyzeTransactionsForSuggestions(transactionIds: string[]): Promise<RuleSuggestion[]> {
    return this.request<RuleSuggestion[]>('/bank/suggestions/analyze', {
      method: 'POST',
      body: JSON.stringify({ transactionIds }),
    });
  }

  async createRuleFromSuggestion(suggestion: RuleSuggestion, accountId?: string, autoPost?: boolean): Promise<any> {
    return this.request<any>('/bank/suggestions/create-rule', {
      method: 'POST',
      body: JSON.stringify({
        ...suggestion,
        accountId,
        autoPost,
      }),
    });
  }

  // ==================== BANK ACCOUNT MAPPINGS ====================

  async getBankMappings(): Promise<any[]> {
    return this.request<any[]>('/bank/mappings');
  }

  async createBankMapping(data: any): Promise<any> {
    return this.request<any>('/bank/mappings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== RECONCILIATION ====================

  async getReconciliationSessions(accountId?: string): Promise<ReconciliationSession[]> {
    const query = accountId ? `?accountId=${accountId}` : '';
    return this.request<ReconciliationSession[]>(`/reconciliation/sessions${query}`);
  }

  async getReconciliationSession(sessionId: string): Promise<ReconciliationSession> {
    return this.request<ReconciliationSession>(`/reconciliation/sessions/${sessionId}`);
  }

  async createReconciliationSession(data: CreateReconciliationSessionRequest): Promise<ReconciliationSession> {
    return this.request<ReconciliationSession>('/reconciliation/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async autoMatchReconciliation(sessionId: string): Promise<{ success: boolean; matched: number; unmatched: number; message: string }> {
    return this.request<{ success: boolean; matched: number; unmatched: number; message: string }>(`/reconciliation/sessions/${sessionId}/auto-match`, {
      method: 'POST',
    });
  }

  async createReconMatch(sessionId: string, data: CreateReconMatchRequest): Promise<any> {
    return this.request(`/reconciliation/sessions/${sessionId}/match`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteReconMatch(matchId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/reconciliation/matches/${matchId}`, {
      method: 'DELETE',
    });
  }

  async finalizeReconciliationSession(sessionId: string): Promise<ReconciliationSession> {
    return this.request<ReconciliationSession>(`/reconciliation/sessions/${sessionId}/finalize`, {
      method: 'POST',
    });
  }

  async getReconciliationSummary(sessionId: string): Promise<ReconciliationSummary> {
    return this.request<ReconciliationSummary>(`/reconciliation/sessions/${sessionId}/summary`);
  }

  // ==================== REPORTS ====================

  async getReportDefinitions(): Promise<ReportDefinition[]> {
    return this.request<ReportDefinition[]>('/reports/definitions');
  }

  async generateReport(definition: ReportDefinition): Promise<GeneratedReport> {
    return this.request<GeneratedReport>('/reports/generate', {
      method: 'POST',
      body: JSON.stringify(definition),
    });
  }

  async getAccountBalances(options: {
    startDate?: string;
    endDate?: string;
    includeMonthly?: boolean;
  }): Promise<{
    accounts: {
      accountId: string;
      accountCode: string;
      accountTitle: string;
      accountType: string;
      normalBalance: string;
      debits: string;
      credits: string;
      monthlyBalances?: { month: number; year: number; debits: string; credits: string }[];
    }[];
  }> {
    const params = new URLSearchParams();
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);
    if (options.includeMonthly) params.set('includeMonthly', 'true');

    return this.request(`/reports/account-balances?${params.toString()}`);
  }

  // ==================== CUSTOM REPORTS ====================

  async getCustomReportDefinitions(): Promise<CustomReportDefinition[]> {
    // For now, return from localStorage until backend is ready
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('custom_report_definitions');
      if (stored) {
        return JSON.parse(stored);
      }
    }
    return [];
  }

  async getCustomReportDefinition(id: string): Promise<CustomReportDefinition | null> {
    const definitions = await this.getCustomReportDefinitions();
    return definitions.find(d => d.id === id) || null;
  }

  async saveCustomReport(definition: CustomReportDefinition): Promise<CustomReportDefinition> {
    const definitions = await this.getCustomReportDefinitions();
    const now = new Date().toISOString();

    if (definition.id) {
      // Update existing
      const index = definitions.findIndex(d => d.id === definition.id);
      if (index !== -1) {
        definitions[index] = { ...definition, updatedAt: now };
      } else {
        definitions.push({ ...definition, updatedAt: now });
      }
    } else {
      // Create new
      definition.id = `custom-${Date.now()}`;
      definition.createdAt = now;
      definition.updatedAt = now;
      definitions.push(definition);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('custom_report_definitions', JSON.stringify(definitions));
    }

    return definition;
  }

  async deleteCustomReport(id: string): Promise<void> {
    const definitions = await this.getCustomReportDefinitions();
    const filtered = definitions.filter(d => d.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('custom_report_definitions', JSON.stringify(filtered));
    }
  }

  async generateCustomReport(definition: CustomReportDefinition): Promise<GeneratedCustomReport> {
    // This would normally call the backend, but for now generate mock data
    const { calculateDateRange } = await import('./reports/period-utils');
    const dateRange = calculateDateRange(definition.period);

    // Get accounts to use for the report
    const accounts = await this.getAccounts();

    // Filter accounts based on definition filters
    let filteredAccounts = accounts;
    if (definition.accountFilters.accountTypes?.length) {
      filteredAccounts = filteredAccounts.filter(a =>
        definition.accountFilters.accountTypes!.includes(a.accountType as any)
      );
    }
    if (definition.accountFilters.accountCodeStart) {
      filteredAccounts = filteredAccounts.filter(a =>
        a.accountCode >= definition.accountFilters.accountCodeStart!
      );
    }
    if (definition.accountFilters.accountCodeEnd) {
      filteredAccounts = filteredAccounts.filter(a =>
        a.accountCode <= definition.accountFilters.accountCodeEnd!
      );
    }

    // Generate mock row data
    const rows = filteredAccounts.map((account, index) => ({
      id: `row-${index}`,
      rowType: 'data' as const,
      indent: 0,
      accountId: account.id,
      accountCode: account.accountCode,
      accountTitle: account.title,
      accountType: account.accountType,
      category: account.category || '',
      values: {
        'account-code': account.accountCode,
        'account-title': account.title,
        'account-type': account.accountType,
        'category': account.category || '',
        'opening-balance': Math.random() * 10000,
        'ending-balance': Math.random() * 15000,
        'debit': Math.random() * 5000,
        'credit': Math.random() * 5000,
        'net-change': Math.random() * 2000 - 1000,
        'period-amount': Math.random() * 8000,
        'ytd-amount': Math.random() * 50000,
        'mtd-amount': Math.random() * 5000,
        'qtd-amount': Math.random() * 15000,
        'budget': Math.random() * 10000,
        'budget-variance': Math.random() * 2000 - 1000,
        'budget-variance-pct': (Math.random() * 20 - 10),
        'prior-period': Math.random() * 8000,
        'prior-period-variance': Math.random() * 2000 - 1000,
        'prior-period-variance-pct': (Math.random() * 20 - 10),
        'prior-year': Math.random() * 7000,
        'prior-year-variance': Math.random() * 3000 - 1500,
        'prior-year-variance-pct': (Math.random() * 30 - 15),
      },
      drillThroughParams: {
        accountId: account.id,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
    }));

    // Calculate grand total
    const grandTotal = {
      id: 'grand-total',
      rowType: 'total' as const,
      indent: 0,
      accountTitle: 'Grand Total',
      values: {} as Record<string, number>,
    };

    // Sum up numeric columns
    const numericColumns = ['opening-balance', 'ending-balance', 'debit', 'credit', 'net-change',
      'period-amount', 'ytd-amount', 'mtd-amount', 'qtd-amount', 'budget', 'budget-variance',
      'prior-period', 'prior-period-variance', 'prior-year', 'prior-year-variance'];

    numericColumns.forEach(col => {
      grandTotal.values[col] = rows.reduce((sum, row) => sum + (Number((row.values as Record<string, unknown>)[col]) || 0), 0);
    });

    return {
      definition,
      generatedAt: new Date().toISOString(),
      orgName: 'Demo Organization',
      periodLabel: dateRange.periodLabel,
      rows,
      grandTotal: definition.grouping.showGrandTotal ? grandTotal : undefined,
      metadata: {
        totalAccounts: rows.length,
        dateRange: {
          start: dateRange.startDate,
          end: dateRange.endDate,
        },
      },
    };
  }

  async getReportDrillThrough(params: {
    accountId: string;
    startDate: string;
    endDate: string;
  }): Promise<PaginatedResponse<DrillThroughTransaction>> {
    // Generate mock drill-through data
    const transactions: DrillThroughTransaction[] = [];
    const numTransactions = Math.floor(Math.random() * 10) + 5;

    for (let i = 0; i < numTransactions; i++) {
      const isDebit = Math.random() > 0.5;
      const amount = Math.random() * 1000 + 100;
      transactions.push({
        id: `txn-${i}`,
        date: params.startDate,
        journalNumber: `JE-${1000 + i}`,
        description: `Transaction ${i + 1}`,
        reference: `REF-${i + 1}`,
        debit: isDebit ? amount : 0,
        credit: isDebit ? 0 : amount,
        runningBalance: Math.random() * 5000,
        journalEntryId: `je-${i}`,
      });
    }

    return {
      data: transactions,
      total: transactions.length,
      page: 1,
      pageSize: 50,
      hasMore: false,
    };
  }

  // ==================== CHART OF ACCOUNTS (ALIAS) ====================

  async getChartOfAccounts(): Promise<Account[]> {
    return this.getAccounts();
  }

  // ==================== ACCOUNTS PAYABLE ====================

  async getVendors(query?: { status?: string; search?: string; page?: number; pageSize?: number }): Promise<{ data: any[]; total: number }> {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.search) params.set('search', query.search);
    if (query?.page) params.set('page', String(query.page));
    if (query?.pageSize) params.set('pageSize', String(query.pageSize));
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/ap/vendors${queryStr}`);
  }

  async getVendor(id: string): Promise<any> {
    return this.request(`/ap/vendors/${id}`);
  }

  async createVendor(data: any): Promise<any> {
    return this.request('/ap/vendors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateVendor(id: string, data: any): Promise<any> {
    return this.request(`/ap/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteVendor(id: string): Promise<void> {
    return this.request(`/ap/vendors/${id}`, { method: 'DELETE' });
  }

  async getBills(query?: { vendorId?: string; status?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<{ data: any[]; total: number }> {
    const params = new URLSearchParams();
    if (query?.vendorId) params.set('vendorId', query.vendorId);
    if (query?.status) params.set('status', query.status);
    if (query?.startDate) params.set('startDate', query.startDate);
    if (query?.endDate) params.set('endDate', query.endDate);
    if (query?.page) params.set('page', String(query.page));
    if (query?.pageSize) params.set('pageSize', String(query.pageSize));
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/ap/bills${queryStr}`);
  }

  async getBill(id: string): Promise<any> {
    return this.request(`/ap/bills/${id}`);
  }

  async createBill(data: any): Promise<any> {
    return this.request('/ap/bills', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBill(id: string, data: any): Promise<any> {
    return this.request(`/ap/bills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBill(id: string): Promise<void> {
    return this.request(`/ap/bills/${id}`, { method: 'DELETE' });
  }

  async postBill(id: string): Promise<any> {
    return this.request(`/ap/bills/${id}/post`, { method: 'POST' });
  }

  async createBillPayment(data: any): Promise<any> {
    return this.request('/ap/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getApSummary(): Promise<any> {
    return this.request('/ap/summary');
  }

  // ==================== ACCOUNTS RECEIVABLE ====================

  async getCustomers(query?: { status?: string; search?: string; page?: number; pageSize?: number }): Promise<{ data: any[]; total: number }> {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.search) params.set('search', query.search);
    if (query?.page) params.set('page', String(query.page));
    if (query?.pageSize) params.set('pageSize', String(query.pageSize));
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/ar/customers${queryStr}`);
  }

  async getCustomer(id: string): Promise<any> {
    return this.request(`/ar/customers/${id}`);
  }

  async createCustomer(data: any): Promise<any> {
    return this.request('/ar/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomer(id: string, data: any): Promise<any> {
    return this.request(`/ar/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomer(id: string): Promise<void> {
    return this.request(`/ar/customers/${id}`, { method: 'DELETE' });
  }

  async getInvoices(query?: { customerId?: string; status?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }): Promise<{ data: any[]; total: number }> {
    const params = new URLSearchParams();
    if (query?.customerId) params.set('customerId', query.customerId);
    if (query?.status) params.set('status', query.status);
    if (query?.startDate) params.set('startDate', query.startDate);
    if (query?.endDate) params.set('endDate', query.endDate);
    if (query?.page) params.set('page', String(query.page));
    if (query?.pageSize) params.set('pageSize', String(query.pageSize));
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/ar/invoices${queryStr}`);
  }

  async getInvoice(id: string): Promise<any> {
    return this.request(`/ar/invoices/${id}`);
  }

  async createInvoice(data: any): Promise<any> {
    return this.request('/ar/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInvoice(id: string, data: any): Promise<any> {
    return this.request(`/ar/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteInvoice(id: string): Promise<void> {
    return this.request(`/ar/invoices/${id}`, { method: 'DELETE' });
  }

  async postInvoice(id: string): Promise<any> {
    return this.request(`/ar/invoices/${id}/post`, { method: 'POST' });
  }

  async createCustomerPayment(data: any): Promise<any> {
    return this.request('/ar/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getArSummary(): Promise<any> {
    return this.request('/ar/summary');
  }
}

export const api = new ApiClient();
