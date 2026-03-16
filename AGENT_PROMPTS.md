# Bank Feed Implementation - Agent Prompts

## Overview

This document contains detailed prompts for 3 specialized agents to implement the complete bank feed matching, auto-posting, and reconciliation system. Agent 1 (Database Schema) has been completed.

---

## AGENT 2: Backend Services - Transaction Matching & Auto-Posting

### Objective
Build backend services for automatic transaction matching, rule-based categorization, journal entry creation from bank feeds, and auto-matching in bank reconciliation.

### Context
- Database schema is complete with: `BankFeedRule`, `BankAccountMapping`, `TransactionMatch`, enhanced `SourceTransaction`
- Backend: NestJS with Prisma
- Multi-tenant architecture with `currentOrgId` in JWT
- All endpoints require `@UseGuards(JwtAuthGuard, TenantGuard)`

### Tasks

#### 1. Enhanced Plaid Sync Service
**File:** `backend/src/modules/plaid/plaid.service.ts`

Add to existing `syncTransactions` method:
- After importing transactions from Plaid, trigger matching engine
- Apply bank feed rules to auto-categorize new transactions
- For high-confidence matches with `autoPost: true`, automatically create journal entries

```typescript
async syncTransactions(orgId: string, plaidItemId?: string) {
  // ... existing sync logic ...

  // After syncing, auto-match transactions
  const newTransactions = await this.prisma.sourceTransaction.findMany({
    where: {
      orgId,
      status: 'PENDING',
      createdAt: { gte: new Date(Date.now() - 60000) } // Last minute
    }
  });

  for (const transaction of newTransactions) {
    await this.matchingService.matchTransaction(transaction.id, orgId);
  }

  return syncResult;
}
```

#### 2. Matching Service
**File:** `backend/src/modules/bank/services/matching.service.ts`

Create service with methods:

```typescript
@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Match a single transaction against all active rules
   * Priority: Exact merchant > Contains text > Regex > Category > Amount range
   */
  async matchTransaction(transactionId: string, orgId: string): Promise<void> {
    const transaction = await this.prisma.sourceTransaction.findUnique({
      where: { id: transactionId },
      include: { plaidAccount: true }
    });

    // Get all active rules sorted by priority
    const rules = await this.prisma.bankFeedRule.findMany({
      where: { orgId, isActive: true },
      orderBy: { priority: 'desc' }
    });

    let bestMatch: { rule: any, confidence: MatchConfidence } | null = null;

    for (const rule of rules) {
      const match = await this.evaluateRule(transaction, rule);
      if (match && (!bestMatch || this.compareConfidence(match.confidence, bestMatch.confidence) > 0)) {
        bestMatch = { rule, confidence: match.confidence };
      }
    }

    if (bestMatch) {
      // Update transaction with match
      await this.prisma.sourceTransaction.update({
        where: { id: transactionId },
        data: {
          matchedRuleId: bestMatch.rule.id,
          matchConfidence: bestMatch.confidence,
          status: 'MATCHED',
          accountId: bestMatch.rule.assignToAccountId,
          memo: bestMatch.rule.defaultMemo || transaction.name
        }
      });

      // Update rule stats
      await this.prisma.bankFeedRule.update({
        where: { id: bestMatch.rule.id },
        data: {
          matchCount: { increment: 1 },
          lastMatchedAt: new Date()
        }
      });

      // Create match suggestion
      await this.prisma.transactionMatch.create({
        data: {
          sourceTransactionId: transactionId,
          suggestedAccountId: bestMatch.rule.assignToAccountId,
          confidence: bestMatch.confidence,
          matchReason: `Rule: ${bestMatch.rule.name}`,
          ruleId: bestMatch.rule.id
        }
      });

      // Auto-post if rule configured
      if (bestMatch.rule.autoPost && bestMatch.confidence === 'HIGH') {
        await this.autoPostService.createJournalFromTransaction(transactionId, orgId);
      }
    }
  }

  private async evaluateRule(transaction: any, rule: any): Promise<{ confidence: MatchConfidence } | null> {
    switch (rule.matchType) {
      case 'EXACT_MERCHANT':
        if (transaction.merchantName?.toLowerCase() === rule.merchantPattern?.toLowerCase()) {
          return { confidence: 'HIGH' };
        }
        break;

      case 'CONTAINS_TEXT':
        const pattern = rule.descriptionPattern?.toLowerCase();
        if (pattern && transaction.name?.toLowerCase().includes(pattern)) {
          return { confidence: 'MEDIUM' };
        }
        break;

      case 'REGEX_PATTERN':
        if (rule.descriptionPattern) {
          const regex = new RegExp(rule.descriptionPattern, 'i');
          if (regex.test(transaction.name) || regex.test(transaction.merchantName || '')) {
            return { confidence: 'MEDIUM' };
          }
        }
        break;

      case 'CATEGORY_MATCH':
        if (rule.categoryPatterns?.length > 0) {
          const txCategories = typeof transaction.category === 'string'
            ? JSON.parse(transaction.category)
            : transaction.category || [];
          const hasMatch = rule.categoryPatterns.some(cat =>
            txCategories.some(txCat => txCat.toLowerCase().includes(cat.toLowerCase()))
          );
          if (hasMatch) return { confidence: 'LOW' };
        }
        break;

      case 'AMOUNT_RANGE':
        const amount = Math.abs(parseFloat(transaction.amount.toString()));
        if (rule.amountMin && rule.amountMax) {
          if (amount >= parseFloat(rule.amountMin.toString()) &&
              amount <= parseFloat(rule.amountMax.toString())) {
            return { confidence: 'LOW' };
          }
        }
        break;
    }

    return null;
  }

  private compareConfidence(a: MatchConfidence, b: MatchConfidence): number {
    const order = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return order[a] - order[b];
  }
}
```

#### 3. Auto-Post Service
**File:** `backend/src/modules/bank/services/auto-post.service.ts`

```typescript
@Injectable()
export class AutoPostService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a journal entry from a bank feed transaction
   */
  async createJournalFromTransaction(transactionId: string, orgId: string): Promise<string> {
    const transaction = await this.prisma.sourceTransaction.findUnique({
      where: { id: transactionId },
      include: {
        plaidAccount: true,
        matchedRule: true
      }
    });

    if (!transaction || !transaction.accountId) {
      throw new Error('Transaction must have an assigned account');
    }

    // Get bank account mapping to find GL cash account
    const mapping = await this.prisma.bankAccountMapping.findUnique({
      where: {
        orgId_plaidAccountId: {
          orgId,
          plaidAccountId: transaction.plaidAccountId
        }
      }
    });

    if (!mapping) {
      throw new Error('Bank account not mapped to GL account');
    }

    const amount = parseFloat(transaction.amount.toString());
    const isDebit = amount < 0; // Negative = money out = credit cash, debit expense
    const absAmount = Math.abs(amount);

    // Get or create GJ journal type
    let journalType = await this.prisma.journalType.findFirst({
      where: { orgId, code: 'GJ' }
    });

    if (!journalType) {
      journalType = await this.prisma.journalType.create({
        data: {
          orgId,
          code: 'GJ',
          name: 'General Journal',
          book: 'Accrual'
        }
      });
    }

    // Create journal entry
    const journalEntry = await this.prisma.journalEntry.create({
      data: {
        orgId,
        journalTypeId: journalType.id,
        entryDate: transaction.date,
        description: `Bank Feed: ${transaction.name}`,
        referenceNumber: transaction.plaidTransactionId,
        status: 'POSTED',
        postingDate: new Date(),
        postedAt: new Date(),
        createdById: transaction.reviewedByUserId || 'system', // TODO: Get from context
        postedById: transaction.reviewedByUserId || 'system',
        lines: {
          create: [
            // Line 1: Bank account (cash)
            {
              lineNumber: 1,
              accountId: mapping.glAccountId,
              debitAmount: isDebit ? null : absAmount,
              creditAmount: isDebit ? absAmount : null,
              memo: transaction.memo || transaction.name
            },
            // Line 2: Expense/Revenue account
            {
              lineNumber: 2,
              accountId: transaction.accountId,
              debitAmount: isDebit ? absAmount : null,
              creditAmount: isDebit ? null : absAmount,
              memo: transaction.memo || transaction.name
            }
          ]
        }
      },
      include: { lines: true }
    });

    // Link transaction to journal entry
    await this.prisma.sourceTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'POSTED',
        journalEntryId: journalEntry.id
      }
    });

    // Create source-to-journal-line links
    for (const line of journalEntry.lines) {
      await this.prisma.sourceToJournalLine.create({
        data: {
          sourceTransactionId: transactionId,
          journalLineId: line.id
        }
      });
    }

    // Create ledger postings
    for (const line of journalEntry.lines) {
      await this.prisma.ledgerPosting.create({
        data: {
          orgId,
          journalEntryId: journalEntry.id,
          accountId: line.accountId,
          postingDate: journalEntry.postingDate,
          debitAmount: line.debitAmount || 0,
          creditAmount: line.creditAmount || 0,
          postingHash: this.generateHash(journalEntry.id, line.id)
        }
      });
    }

    return journalEntry.id;
  }

  private generateHash(journalEntryId: string, lineId: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(`${journalEntryId}-${lineId}`).digest('hex');
  }
}
```

#### 4. Bank Reconciliation Auto-Match Service
**File:** `backend/src/modules/bank/services/recon-auto-match.service.ts`

```typescript
@Injectable()
export class ReconAutoMatchService {
  constructor(private prisma: PrismaService) {}

  /**
   * Auto-match source transactions to journal lines during reconciliation
   * Matches based on: date, amount, and description similarity
   */
  async autoMatchReconSession(reconSessionId: string, orgId: string): Promise<{
    matched: number;
    unmatched: number;
  }> {
    const session = await this.prisma.reconSession.findUnique({
      where: { id: reconSessionId },
      include: { account: true }
    });

    if (!session) {
      throw new Error('Reconciliation session not found');
    }

    // Get bank account mapping to find associated plaid account
    const mapping = await this.prisma.bankAccountMapping.findFirst({
      where: {
        orgId,
        glAccountId: session.accountId
      }
    });

    if (!mapping) {
      throw new Error('Bank account not mapped to Plaid account');
    }

    // Get all unmatched source transactions in the period
    const sourceTransactions = await this.prisma.sourceTransaction.findMany({
      where: {
        orgId,
        plaidAccountId: mapping.plaidAccountId,
        date: {
          lte: session.statementEndDate
        },
        status: { in: ['POSTED', 'CATEGORIZED'] },
        reconMatches: { none: {} } // Not already matched
      },
      orderBy: { date: 'asc' }
    });

    // Get all journal lines for this account in the period
    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        accountId: session.accountId,
        journalEntry: {
          orgId,
          status: 'POSTED',
          postingDate: {
            lte: session.statementEndDate
          }
        },
        reconMatches: { none: {} } // Not already matched
      },
      include: {
        journalEntry: true
      },
      orderBy: { journalEntry: { entryDate: 'asc' } }
    });

    let matchedCount = 0;

    for (const sourceTx of sourceTransactions) {
      // Try to find matching journal line
      const match = this.findBestMatch(sourceTx, journalLines);

      if (match) {
        await this.prisma.reconMatch.create({
          data: {
            reconSessionId,
            sourceTransactionId: sourceTx.id,
            journalLineId: match.id,
            matchType: 'source_to_journal'
          }
        });

        matchedCount++;

        // Remove matched line from pool
        const index = journalLines.findIndex(jl => jl.id === match.id);
        if (index > -1) journalLines.splice(index, 1);
      }
    }

    return {
      matched: matchedCount,
      unmatched: sourceTransactions.length - matchedCount
    };
  }

  private findBestMatch(sourceTx: any, journalLines: any[]): any | null {
    const sourceTxAmount = Math.abs(parseFloat(sourceTx.amount.toString()));
    const sourceTxDate = new Date(sourceTx.date);

    // Look for exact amount and date match within 3 days
    for (const jl of journalLines) {
      const jlAmount = parseFloat(jl.debitAmount?.toString() || jl.creditAmount?.toString() || '0');
      const jlDate = new Date(jl.journalEntry.entryDate);
      const daysDiff = Math.abs((sourceTxDate.getTime() - jlDate.getTime()) / (1000 * 60 * 60 * 24));

      if (Math.abs(sourceTxAmount - jlAmount) < 0.01 && daysDiff <= 3) {
        // Check description similarity
        const similarity = this.calculateSimilarity(
          sourceTx.name || sourceTx.merchantName,
          jl.memo || jl.journalEntry.description
        );

        if (similarity > 0.5) {
          return jl;
        }
      }
    }

    // Fallback: exact amount match within 7 days
    for (const jl of journalLines) {
      const jlAmount = parseFloat(jl.debitAmount?.toString() || jl.creditAmount?.toString() || '0');
      const jlDate = new Date(jl.journalEntry.entryDate);
      const daysDiff = Math.abs((sourceTxDate.getTime() - jlDate.getTime()) / (1000 * 60 * 60 * 24));

      if (Math.abs(sourceTxAmount - jlAmount) < 0.01 && daysDiff <= 7) {
        return jl;
      }
    }

    return null;
  }

  /**
   * Simple Levenshtein-based similarity score
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // Simple word overlap
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w)).length;

    return commonWords / Math.max(words1.length, words2.length);
  }
}
```

#### 5. Bank Controller Endpoints
**File:** `backend/src/modules/bank/bank.controller.ts`

Add new endpoints:

```typescript
@Controller('bank')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BankController {
  constructor(
    private matchingService: MatchingService,
    private autoPostService: AutoPostService,
    private reconAutoMatchService: ReconAutoMatchService,
    private prisma: PrismaService
  ) {}

  // Get all bank feed rules
  @Get('rules')
  async getRules(@Req() req) {
    return this.prisma.bankFeedRule.findMany({
      where: { orgId: req.user.currentOrgId },
      include: { assignToAccount: true },
      orderBy: { priority: 'desc' }
    });
  }

  // Create bank feed rule
  @Post('rules')
  async createRule(@Req() req, @Body() dto: CreateBankFeedRuleDto) {
    return this.prisma.bankFeedRule.create({
      data: {
        ...dto,
        orgId: req.user.currentOrgId
      }
    });
  }

  // Update rule
  @Put('rules/:id')
  async updateRule(@Req() req, @Param('id') id: string, @Body() dto: UpdateBankFeedRuleDto) {
    return this.prisma.bankFeedRule.update({
      where: { id },
      data: dto
    });
  }

  // Delete rule
  @Delete('rules/:id')
  async deleteRule(@Param('id') id: string) {
    return this.prisma.bankFeedRule.delete({ where: { id } });
  }

  // Manually trigger matching for a transaction
  @Post('transactions/:id/match')
  async matchTransaction(@Req() req, @Param('id') id: string) {
    await this.matchingService.matchTransaction(id, req.user.currentOrgId);
    return { success: true };
  }

  // Batch match transactions
  @Post('transactions/match-batch')
  async matchBatch(@Req() req, @Body() dto: { transactionIds: string[] }) {
    const results = [];
    for (const id of dto.transactionIds) {
      await this.matchingService.matchTransaction(id, req.user.currentOrgId);
      results.push({ id, success: true });
    }
    return results;
  }

  // Create journal entry from transaction
  @Post('transactions/:id/post')
  async postTransaction(@Req() req, @Param('id') id: string) {
    const journalId = await this.autoPostService.createJournalFromTransaction(
      id,
      req.user.currentOrgId
    );
    return { journalId };
  }

  // Batch post transactions
  @Post('transactions/post-batch')
  async postBatch(@Req() req, @Body() dto: { transactionIds: string[] }) {
    const results = [];
    for (const id of dto.transactionIds) {
      try {
        const journalId = await this.autoPostService.createJournalFromTransaction(
          id,
          req.user.currentOrgId
        );
        results.push({ id, journalId, success: true });
      } catch (error) {
        results.push({ id, error: error.message, success: false });
      }
    }
    return results;
  }

  // Get/Create bank account mapping
  @Get('mappings')
  async getMappings(@Req() req) {
    return this.prisma.bankAccountMapping.findMany({
      where: { orgId: req.user.currentOrgId },
      include: {
        glAccount: true,
        defaultOffsetAccount: true
      }
    });
  }

  @Post('mappings')
  async createMapping(@Req() req, @Body() dto: CreateBankMappingDto) {
    return this.prisma.bankAccountMapping.create({
      data: {
        ...dto,
        orgId: req.user.currentOrgId
      }
    });
  }

  // Auto-match reconciliation
  @Post('reconciliation/:sessionId/auto-match')
  async autoMatchRecon(@Req() req, @Param('sessionId') sessionId: string) {
    return this.reconAutoMatchService.autoMatchReconSession(
      sessionId,
      req.user.currentOrgId
    );
  }
}
```

#### 6. Module Setup
**File:** `backend/src/modules/bank/bank.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { BankController } from './bank.controller';
import { MatchingService } from './services/matching.service';
import { AutoPostService } from './services/auto-post.service';
import { ReconAutoMatchService } from './services/recon-auto-match.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BankController],
  providers: [
    MatchingService,
    AutoPostService,
    ReconAutoMatchService
  ],
  exports: [
    MatchingService,
    AutoPostService,
    ReconAutoMatchService
  ]
})
export class BankModule {}
```

### DTOs
**File:** `backend/src/modules/bank/dto/index.ts`

```typescript
export class CreateBankFeedRuleDto {
  name: string;
  description?: string;
  priority?: number;
  isActive?: boolean;
  matchType: 'EXACT_MERCHANT' | 'CONTAINS_TEXT' | 'REGEX_PATTERN' | 'AMOUNT_RANGE' | 'CATEGORY_MATCH' | 'COMBINED';
  merchantPattern?: string;
  descriptionPattern?: string;
  categoryPatterns?: string[];
  amountMin?: number;
  amountMax?: number;
  assignToAccountId: string;
  defaultMemo?: string;
  autoPost?: boolean;
  dimensionValues?: string;
}

export class UpdateBankFeedRuleDto extends PartialType(CreateBankFeedRuleDto) {}

export class CreateBankMappingDto {
  plaidAccountId: string;
  glAccountId: string;
  enableAutoPosting?: boolean;
  defaultOffsetAccountId?: string;
}
```

### Success Criteria
- [ ] Transactions auto-match on Plaid sync based on rules
- [ ] High-confidence matches with autoPost=true create journals automatically
- [ ] Manual match/post endpoints work for batch operations
- [ ] Bank reconciliation auto-matches source transactions to journal lines
- [ ] Match algorithm considers date (±3 days), amount (exact), and description similarity
- [ ] All endpoints are multi-tenant isolated with TenantGuard

---

## AGENT 3: Frontend UI - Bank Feeds Dashboard & Transaction Management

### Objective
Build comprehensive React frontend for reviewing bank feeds, managing matching rules, and handling transaction categorization with inline editing.

### Context
- Next.js 16 (App Router) with TypeScript
- Tailwind CSS + shadcn/ui components
- Frontend on port 3020, backend API at `http://localhost:3019/api`
- JWT auth with `api.ts` client wrapper

### Tasks

#### 1. Enhanced Bank Feeds Dashboard
**File:** `src/app/(dashboard)/bank-feeds/page.tsx`

Replace with tabbed interface:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BankAccountsList } from '@/components/bank/bank-accounts-list';
import { TransactionList } from '@/components/bank/transaction-list';
import { RulesManager } from '@/components/bank/rules-manager';
import { ReconciliationPanel } from '@/components/bank/reconciliation-panel';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function BankFeedsPage() {
  const [activeTab, setActiveTab] = useState('transactions');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await api.syncPlaidTransactions();
      setLastSync(result.syncedAt);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Bank Feeds</h1>
          <p className="text-sm text-zinc-600 mt-1">
            Manage bank connections, review transactions, and automate categorization
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSync && (
            <span className="text-sm text-zinc-500">
              Last synced: {new Date(lastSync).toLocaleString()}
            </span>
          )}
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Transactions'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="accounts">Bank Accounts</TabsTrigger>
          <TabsTrigger value="rules">Matching Rules</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-6">
          <TransactionList onSync={handleSync} />
        </TabsContent>

        <TabsContent value="accounts" className="mt-6">
          <BankAccountsList />
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <RulesManager />
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-6">
          <ReconciliationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### 2. Transaction List with Inline Review
**File:** `src/components/bank/transaction-list.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Check, X, DollarSign, Calendar,
  Tag, AlertCircle, ChevronRight
} from 'lucide-react';

interface Transaction {
  id: string;
  date: string;
  name: string;
  merchantName?: string;
  amount: number;
  status: 'PENDING' | 'MATCHED' | 'CATEGORIZED' | 'POSTED' | 'EXCLUDED';
  matchConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  accountId?: string;
  memo?: string;
  plaidAccount?: { name: string };
}

export function TransactionList({ onSync }: { onSync: () => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState([]);
  const [filter, setFilter] = useState('PENDING');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [txs, accts] = await Promise.all([
        api.request(`/bank/transactions?status=${filter}`),
        api.getChartOfAccounts()
      ]);
      setTransactions(txs);
      setAccounts(accts);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchBatch = async () => {
    await api.request('/bank/transactions/match-batch', {
      method: 'POST',
      body: JSON.stringify({ transactionIds: selected })
    });
    loadData();
    setSelected([]);
  };

  const handlePostBatch = async () => {
    await api.request('/bank/transactions/post-batch', {
      method: 'POST',
      body: JSON.stringify({ transactionIds: selected })
    });
    loadData();
    setSelected([]);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getStatusBadge = (status: string, confidence?: string) => {
    const variants: Record<string, string> = {
      PENDING: 'bg-gray-100 text-gray-800',
      MATCHED: 'bg-blue-100 text-blue-800',
      CATEGORIZED: 'bg-yellow-100 text-yellow-800',
      POSTED: 'bg-green-100 text-green-800',
      EXCLUDED: 'bg-red-100 text-red-800'
    };

    return (
      <div className="flex items-center gap-2">
        <Badge className={variants[status] || variants.PENDING}>
          {status}
        </Badge>
        {confidence && (
          <span className={`text-xs px-2 py-0.5 rounded ${
            confidence === 'HIGH' ? 'bg-green-50 text-green-700' :
            confidence === 'MEDIUM' ? 'bg-yellow-50 text-yellow-700' :
            'bg-gray-50 text-gray-700'
          }`}>
            {confidence}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <option value="PENDING">Pending ({transactions.length})</option>
            <option value="MATCHED">Matched</option>
            <option value="CATEGORIZED">Categorized</option>
            <option value="POSTED">Posted</option>
          </Select>

          {selected.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-600">
                {selected.length} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleMatchBatch}
              >
                Match Selected
              </Button>
              <Button
                size="sm"
                onClick={handlePostBatch}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Post Selected
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-lg border border-zinc-200">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="w-12 p-3">
                <Checkbox
                  checked={selected.length === transactions.length}
                  onCheckedChange={(checked) => {
                    setSelected(checked ? transactions.map(t => t.id) : []);
                  }}
                />
              </th>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Date</th>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Description</th>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Bank Account</th>
              <th className="text-right p-3 text-sm font-medium text-zinc-700">Amount</th>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Category</th>
              <th className="text-left p-3 text-sm font-medium text-zinc-700">Status</th>
              <th className="w-12 p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                accounts={accounts}
                isSelected={selected.includes(tx.id)}
                onToggleSelect={toggleSelect}
                onUpdate={loadData}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransactionRow({ transaction, accounts, isSelected, onToggleSelect, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [accountId, setAccountId] = useState(transaction.accountId || '');
  const [memo, setMemo] = useState(transaction.memo || '');

  const handleSave = async () => {
    await api.request(`/bank/transactions/${transaction.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ accountId, memo, status: 'CATEGORIZED' })
    });
    setEditing(false);
    onUpdate();
  };

  return (
    <tr className="hover:bg-zinc-50">
      <td className="p-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(transaction.id)}
        />
      </td>
      <td className="p-3 text-sm text-zinc-900">
        {new Date(transaction.date).toLocaleDateString()}
      </td>
      <td className="p-3">
        <div>
          <div className="text-sm font-medium text-zinc-900">
            {transaction.merchantName || transaction.name}
          </div>
          {editing ? (
            <Input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Add memo..."
              className="mt-1 text-xs"
            />
          ) : (
            <div className="text-xs text-zinc-500">{memo || transaction.name}</div>
          )}
        </div>
      </td>
      <td className="p-3 text-sm text-zinc-600">
        {transaction.plaidAccount?.name}
      </td>
      <td className="p-3 text-sm text-right font-medium">
        <span className={transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}>
          ${Math.abs(transaction.amount).toFixed(2)}
        </span>
      </td>
      <td className="p-3">
        {editing ? (
          <Select value={accountId} onValueChange={setAccountId}>
            <option value="">Select account...</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.accountCode} - {acc.title}
              </option>
            ))}
          </Select>
        ) : (
          <div className="text-sm text-zinc-700">
            {accounts.find(a => a.id === accountId)?.title || '—'}
          </div>
        )}
      </td>
      <td className="p-3">
        {getStatusBadge(transaction.status, transaction.matchConfidence)}
      </td>
      <td className="p-3">
        {editing ? (
          <div className="flex gap-1">
            <Button size="sm" onClick={handleSave}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}

function getStatusBadge(status: string, confidence?: string) {
  // ... same as above
}
```

#### 3. Rules Manager
**File:** `src/components/bank/rules-manager.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export function RulesManager() {
  const [rules, setRules] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const data = await api.request('/bank/rules');
    setRules(data);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this rule?')) {
      await api.request(`/bank/rules/${id}`, { method: 'DELETE' });
      loadRules();
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await api.request(`/bank/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isActive: !isActive })
    });
    loadRules();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Matching Rules</h2>
          <p className="text-sm text-zinc-600">
            Create rules to automatically categorize bank transactions
          </p>
        </div>
        <Button onClick={() => { setEditingRule(null); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Rule
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left p-3 text-sm font-medium">Priority</th>
              <th className="text-left p-3 text-sm font-medium">Rule Name</th>
              <th className="text-left p-3 text-sm font-medium">Match Type</th>
              <th className="text-left p-3 text-sm font-medium">Assigns To</th>
              <th className="text-center p-3 text-sm font-medium">Auto-Post</th>
              <th className="text-center p-3 text-sm font-medium">Matches</th>
              <th className="text-center p-3 text-sm font-medium">Active</th>
              <th className="w-32 p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-zinc-50">
                <td className="p-3 text-sm text-zinc-900">{rule.priority}</td>
                <td className="p-3">
                  <div className="text-sm font-medium text-zinc-900">{rule.name}</div>
                  <div className="text-xs text-zinc-500">{rule.description}</div>
                </td>
                <td className="p-3 text-sm text-zinc-700">{rule.matchType}</td>
                <td className="p-3 text-sm text-zinc-700">
                  {rule.assignToAccount?.title}
                </td>
                <td className="p-3 text-center">
                  {rule.autoPost ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className="p-3 text-center text-sm text-zinc-600">
                  {rule.matchCount}
                </td>
                <td className="p-3 text-center">
                  <Checkbox
                    checked={rule.isActive}
                    onCheckedChange={() => handleToggleActive(rule.id, rule.isActive)}
                  />
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setEditingRule(rule); setShowDialog(true); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDialog && (
        <RuleEditorDialog
          rule={editingRule}
          onClose={() => setShowDialog(false)}
          onSave={() => { setShowDialog(false); loadRules(); }}
        />
      )}
    </div>
  );
}

function RuleEditorDialog({ rule, onClose, onSave }) {
  // Form for creating/editing rules
  // Fields: name, description, matchType, patterns, account assignment, autoPost
  // Implementation similar to transaction editing
}
```

#### 4. Add API Methods
**File:** `src/lib/api.ts`

```typescript
// Add these methods to the API class

async getBankTransactions(status?: string): Promise<any[]> {
  return this.request(`/bank/transactions${status ? `?status=${status}` : ''}`);
}

async matchTransaction(id: string): Promise<void> {
  return this.request(`/bank/transactions/${id}/match`, { method: 'POST' });
}

async postTransaction(id: string): Promise<{ journalId: string }> {
  return this.request(`/bank/transactions/${id}/post`, { method: 'POST' });
}

async getBankFeedRules(): Promise<any[]> {
  return this.request('/bank/rules');
}

async createBankFeedRule(data: any): Promise<any> {
  return this.request('/bank/rules', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

async updateBankFeedRule(id: string, data: any): Promise<any> {
  return this.request(`/bank/rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

async deleteBankFeedRule(id: string): Promise<void> {
  return this.request(`/bank/rules/${id}`, { method: 'DELETE' });
}

async autoMatchReconciliation(sessionId: string): Promise<{ matched: number; unmatched: number }> {
  return this.request(`/bank/reconciliation/${sessionId}/auto-match`, {
    method: 'POST'
  });
}
```

### Success Criteria
- [ ] Transaction list shows all bank feed transactions with filtering
- [ ] Inline editing allows quick categorization
- [ ] Batch operations work for match/post
- [ ] Rules manager allows CRUD on matching rules
- [ ] Status badges clearly indicate transaction states (PENDING, MATCHED, POSTED)
- [ ] Reconciliation panel can trigger auto-matching

---

## AGENT 4: Integration Testing & Documentation

### Objective
Create comprehensive integration tests, validate end-to-end workflows, and document the system for handoff.

### Context
- Backend: NestJS with Prisma
- Frontend: Next.js 16
- Test Framework: Jest (backend), Playwright (frontend)

### Tasks

#### 1. Backend Integration Tests
**File:** `backend/test/bank-feed-integration.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('Bank Feed Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let orgId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    // Create test user and org
    const user = await prisma.user.create({
      data: {
        email: 'test-bank@example.com',
        passwordHash: 'hashed',
        name: 'Test User'
      }
    });

    const org = await prisma.org.create({
      data: { name: 'Test Org' }
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role: 'admin'
      }
    });

    orgId = org.id;

    // Login
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'test-bank@example.com', password: 'password' });

    authToken = response.body.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('Bank Feed Matching', () => {
    let cashAccount: any;
    let expenseAccount: any;
    let sourceTransaction: any;

    beforeEach(async () => {
      // Create test accounts
      cashAccount = await prisma.account.create({
        data: {
          orgId,
          accountCode: '1000',
          title: 'Cash',
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
          closingType: 'NON_CLOSING',
          isBankAccount: true
        }
      });

      expenseAccount = await prisma.account.create({
        data: {
          orgId,
          accountCode: '5000',
          title: 'Office Supplies',
          accountType: 'EXPENSE',
          normalBalance: 'DEBIT',
          closingType: 'CLOSING'
        }
      });

      // Create source transaction
      sourceTransaction = await prisma.sourceTransaction.create({
        data: {
          orgId,
          plaidTransactionId: 'test-tx-001',
          amount: -50.00,
          date: new Date(),
          name: 'Office Depot',
          merchantName: 'Office Depot',
          status: 'PENDING'
        }
      });
    });

    it('should create and apply a matching rule', async () => {
      // Create rule
      const ruleResponse = await request(app.getHttpServer())
        .post('/api/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Office Supplies Rule',
          matchType: 'CONTAINS_TEXT',
          descriptionPattern: 'Office Depot',
          assignToAccountId: expenseAccount.id,
          autoPost: false,
          priority: 10
        })
        .expect(201);

      const ruleId = ruleResponse.body.id;

      // Match transaction
      await request(app.getHttpServer())
        .post(`/api/bank/transactions/${sourceTransaction.id}/match`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Verify transaction was matched
      const matched = await prisma.sourceTransaction.findUnique({
        where: { id: sourceTransaction.id }
      });

      expect(matched.status).toBe('MATCHED');
      expect(matched.accountId).toBe(expenseAccount.id);
      expect(matched.matchedRuleId).toBe(ruleId);
    });

    it('should auto-post high-confidence matched transactions', async () => {
      // Create bank account mapping first
      await prisma.bankAccountMapping.create({
        data: {
          orgId,
          plaidAccountId: 'test-plaid-account',
          glAccountId: cashAccount.id,
          enableAutoPosting: true
        }
      });

      // Update transaction with plaidAccountId
      await prisma.sourceTransaction.update({
        where: { id: sourceTransaction.id },
        data: { plaidAccountId: 'test-plaid-account' }
      });

      // Create auto-post rule
      await request(app.getHttpServer())
        .post('/api/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Auto-Post Office Supplies',
          matchType: 'EXACT_MERCHANT',
          merchantPattern: 'Office Depot',
          assignToAccountId: expenseAccount.id,
          autoPost: true,
          priority: 10
        });

      // Match transaction (should auto-post)
      await request(app.getHttpServer())
        .post(`/api/bank/transactions/${sourceTransaction.id}/match`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Verify journal was created
      const posted = await prisma.sourceTransaction.findUnique({
        where: { id: sourceTransaction.id },
        include: { journalEntry: true }
      });

      expect(posted.status).toBe('POSTED');
      expect(posted.journalEntry).toBeDefined();
      expect(posted.journalEntry.status).toBe('POSTED');
    });

    it('should auto-match transactions in reconciliation', async () => {
      // Create journal entry manually
      const journalType = await prisma.journalType.create({
        data: {
          orgId,
          code: 'GJ',
          name: 'General Journal',
          book: 'Accrual'
        }
      });

      const journalEntry = await prisma.journalEntry.create({
        data: {
          orgId,
          journalTypeId: journalType.id,
          entryDate: sourceTransaction.date,
          description: 'Office Depot Purchase',
          status: 'POSTED',
          postingDate: new Date(),
          postedAt: new Date(),
          createdById: 'system',
          postedById: 'system',
          lines: {
            create: [
              {
                lineNumber: 1,
                accountId: cashAccount.id,
                creditAmount: 50.00,
                memo: 'Office Depot'
              },
              {
                lineNumber: 2,
                accountId: expenseAccount.id,
                debitAmount: 50.00,
                memo: 'Office Depot'
              }
            ]
          }
        },
        include: { lines: true }
      });

      // Create recon session
      const reconSession = await prisma.reconSession.create({
        data: {
          orgId,
          accountId: cashAccount.id,
          statementBeginningBalance: 1000.00,
          statementEndingBalance: 950.00,
          statementEndDate: new Date(),
          status: 'draft'
        }
      });

      // Create bank account mapping
      await prisma.bankAccountMapping.create({
        data: {
          orgId,
          plaidAccountId: 'test-plaid-account',
          glAccountId: cashAccount.id
        }
      });

      // Update source transaction
      await prisma.sourceTransaction.update({
        where: { id: sourceTransaction.id },
        data: {
          plaidAccountId: 'test-plaid-account',
          status: 'POSTED'
        }
      });

      // Trigger auto-match
      const matchResult = await request(app.getHttpServer())
        .post(`/api/bank/reconciliation/${reconSession.id}/auto-match`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(matchResult.body.matched).toBeGreaterThan(0);

      // Verify match was created
      const matches = await prisma.reconMatch.findMany({
        where: { reconSessionId: reconSession.id }
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].sourceTransactionId).toBe(sourceTransaction.id);
    });
  });
});
```

#### 2. Frontend E2E Tests
**File:** `tests/bank-feeds.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Bank Feeds Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3020/login');
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');
  });

  test('should display bank feeds page with tabs', async ({ page }) => {
    await page.goto('http://localhost:3020/bank-feeds');

    // Verify tabs are visible
    await expect(page.locator('text=Transactions')).toBeVisible();
    await expect(page.locator('text=Bank Accounts')).toBeVisible();
    await expect(page.locator('text=Matching Rules')).toBeVisible();
    await expect(page.locator('text=Reconciliation')).toBeVisible();
  });

  test('should create a new matching rule', async ({ page }) => {
    await page.goto('http://localhost:3020/bank-feeds');
    await page.click('text=Matching Rules');

    // Click New Rule
    await page.click('button:has-text("New Rule")');

    // Fill form
    await page.fill('[name="name"]', 'Test Rule');
    await page.fill('[name="description"]', 'Test rule for Office Depot');
    await page.selectOption('[name="matchType"]', 'CONTAINS_TEXT');
    await page.fill('[name="descriptionPattern"]', 'Office Depot');

    // Save
    await page.click('button:has-text("Save")');

    // Verify rule appears in list
    await expect(page.locator('text=Test Rule')).toBeVisible();
  });

  test('should match and post a transaction', async ({ page }) => {
    await page.goto('http://localhost:3020/bank-feeds');

    // Should see pending transactions
    await expect(page.locator('table tbody tr')).toHaveCount({ minimum: 1 });

    // Select first transaction
    await page.click('table tbody tr:first-child input[type="checkbox"]');

    // Match
    await page.click('button:has-text("Match Selected")');
    await page.waitForTimeout(1000);

    // Should see MATCHED status
    await expect(page.locator('text=MATCHED')).toBeVisible();

    // Post
    await page.click('table tbody tr:first-child input[type="checkbox"]');
    await page.click('button:has-text("Post Selected")');
    await page.waitForTimeout(1000);

    // Should see POSTED status
    await expect(page.locator('text=POSTED')).toBeVisible();
  });
});
```

#### 3. Documentation
**File:** `docs/BANK_FEEDS_GUIDE.md`

```markdown
# Bank Feeds System - User Guide

## Overview
The bank feeds system automatically imports transactions from connected bank accounts via Plaid, categorizes them using matching rules, and creates journal entries.

## Key Features

### 1. Automatic Transaction Import
- Connects to banks via Plaid
- Syncs transactions daily
- Stores raw transaction data with parsed fields

### 2. Matching Rules Engine
- Create rules to auto-categorize transactions
- Match types: Exact merchant, contains text, regex, category, amount range
- Priority-based evaluation
- High-confidence matches can auto-post

### 3. Journal Entry Creation
- Manually or automatically create journal entries from bank transactions
- Links source transactions to journal lines
- Maintains audit trail

### 4. Bank Reconciliation Auto-Matching
- When starting a reconciliation, the system automatically matches:
  - Source transactions (from bank feeds)
  - Journal lines (from manual entries)
- Matching algorithm:
  - Exact amount match
  - Date within ±3 days
  - Description similarity score > 50%

## Workflow

### Step 1: Connect Bank Account
1. Go to **Bank Feeds** > **Bank Accounts**
2. Click **Connect Bank Account**
3. Complete Plaid Link flow
4. Map Plaid account to GL cash account

### Step 2: Create Matching Rules
1. Go to **Bank Feeds** > **Matching Rules**
2. Click **New Rule**
3. Configure:
   - Name and description
   - Match type (e.g., "Contains Text")
   - Pattern (e.g., "Amazon")
   - Assign to GL account (e.g., "Office Supplies")
   - Enable auto-post for high-confidence matches
4. Set priority (higher = evaluated first)

### Step 3: Review Transactions
1. Go to **Bank Feeds** > **Transactions**
2. Filter by status (Pending, Matched, Categorized, Posted)
3. For each transaction:
   - Review auto-matched category
   - Edit memo if needed
   - Manually assign category if not matched
4. Select multiple transactions for batch operations:
   - **Match Selected**: Apply rules
   - **Post Selected**: Create journal entries

### Step 4: Reconcile
1. Go to **Bank Feeds** > **Reconciliation**
2. Select bank account
3. Enter statement details
4. Click **Auto-Match**
   - System matches bank transactions to journal lines
   - Shows matched/unmatched counts
5. Review matches and finalize

## API Endpoints

### Matching Rules
- `GET /api/bank/rules` - List all rules
- `POST /api/bank/rules` - Create rule
- `PUT /api/bank/rules/:id` - Update rule
- `DELETE /api/bank/rules/:id` - Delete rule

### Transactions
- `GET /api/bank/transactions?status=PENDING` - List transactions
- `POST /api/bank/transactions/:id/match` - Match single transaction
- `POST /api/bank/transactions/match-batch` - Match multiple
- `POST /api/bank/transactions/:id/post` - Create journal entry
- `POST /api/bank/transactions/post-batch` - Post multiple

### Reconciliation
- `POST /api/bank/reconciliation/:sessionId/auto-match` - Auto-match transactions

## Database Models

### SourceTransaction
- Stores raw Plaid transaction data
- Status: PENDING → MATCHED → CATEGORIZED → POSTED
- Links to journal entries via `SourceToJournalLine`

### BankFeedRule
- Defines matching criteria
- Assigns to GL account
- Can auto-post high-confidence matches

### BankAccountMapping
- Maps Plaid account to GL account
- Required for journal entry creation

### ReconMatch
- Links source transactions to journal lines during reconciliation
- Enables automatic matching based on date/amount/description
```

### Success Criteria
- [ ] Backend integration tests pass (matching, auto-posting, reconciliation)
- [ ] Frontend E2E tests pass (rule creation, transaction review, batch operations)
- [ ] Documentation covers all features and workflows
- [ ] Handoff guide explains system architecture and key design decisions

---

## Summary

These 3 agents will complete the bank feeds implementation:

1. **Agent 2 (Backend)**: Matching engine, auto-posting service, reconciliation auto-match
2. **Agent 3 (Frontend)**: Transaction review UI, rules manager, batch operations
3. **Agent 4 (Testing)**: Integration tests, E2E tests, documentation

### Key Innovations

1. **Auto-Matching in Reconciliation**: When a reconciliation period is started, the system automatically matches bank feed transactions to journal lines based on:
   - Exact amount match
   - Date proximity (±3 days)
   - Description similarity (Levenshtein distance)

2. **Transaction Status Flow**:
   - `PENDING` → `MATCHED` → `CATEGORIZED` → `POSTED`
   - Each status change is auditable

3. **Rule Priority System**: Higher priority rules evaluated first, preventing conflicts

4. **Confidence Scoring**: `HIGH`, `MEDIUM`, `LOW` confidence levels guide auto-posting decisions

### Critical Dependencies

- Agent 2 must complete before Agent 3 (frontend needs backend APIs)
- Agent 4 can run in parallel once Agent 2 and 3 are done

### Estimated Timeline

- Agent 2: 3-4 days
- Agent 3: 2-3 days
- Agent 4: 1-2 days
- **Total: 6-9 days**
