# Bank Feed Implementation - Parallel Agent Prompts

## Overview
This document contains detailed prompts for 3 specialized agents working **IN PARALLEL** to implement the complete bank feed matching, auto-posting, and reconciliation system.

**Database Schema (Agent 1):** ✅ COMPLETED

### API Contract (Shared Knowledge)
All agents should reference this API contract to work independently:

```typescript
// === BANK FEED API ENDPOINTS ===

// Rules Management
GET    /api/bank/rules                          // List all rules
POST   /api/bank/rules                          // Create rule
PUT    /api/bank/rules/:id                      // Update rule
DELETE /api/bank/rules/:id                      // Delete rule

// Transaction Management
GET    /api/bank/transactions?status=PENDING    // List transactions (filter by status)
PATCH  /api/bank/transactions/:id               // Update transaction (accountId, memo, status)
POST   /api/bank/transactions/:id/match         // Match single transaction
POST   /api/bank/transactions/match-batch       // Match multiple: { transactionIds: string[] }
POST   /api/bank/transactions/:id/post          // Create journal entry
POST   /api/bank/transactions/post-batch        // Post multiple: { transactionIds: string[] }

// Bank Account Mapping
GET    /api/bank/mappings                       // List all mappings
POST   /api/bank/mappings                       // Create mapping
PUT    /api/bank/mappings/:id                   // Update mapping
DELETE /api/bank/mappings/:id                   // Delete mapping

// Reconciliation
POST   /api/bank/reconciliation/:sessionId/auto-match  // Auto-match: returns { matched: number, unmatched: number }

// === DATA TYPES ===

interface SourceTransaction {
  id: string;
  orgId: string;
  plaidAccountId: string;
  plaidTransactionId: string;
  amount: number;
  date: string;
  name: string;
  merchantName?: string;
  category?: string[];
  pending: boolean;
  status: 'PENDING' | 'MATCHED' | 'CATEGORIZED' | 'POSTED' | 'EXCLUDED';
  accountId?: string;
  memo?: string;
  matchedRuleId?: string;
  matchConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  reviewedAt?: string;
  plaidAccount?: { id: string; name: string; };
  matchedRule?: BankFeedRule;
}

interface BankFeedRule {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  priority: number;
  isActive: boolean;
  matchType: 'EXACT_MERCHANT' | 'CONTAINS_TEXT' | 'REGEX_PATTERN' | 'AMOUNT_RANGE' | 'CATEGORY_MATCH' | 'COMBINED';
  merchantPattern?: string;
  descriptionPattern?: string;
  categoryPatterns?: string[];
  amountMin?: number;
  amountMax?: number;
  assignToAccountId: string;
  defaultMemo?: string;
  autoPost: boolean;
  dimensionValues?: any;
  matchCount: number;
  lastMatchedAt?: string;
  assignToAccount?: Account;
}

interface BankAccountMapping {
  id: string;
  orgId: string;
  plaidAccountId: string;
  glAccountId: string;
  enableAutoPosting: boolean;
  defaultOffsetAccountId?: string;
  glAccount: Account;
  defaultOffsetAccount?: Account;
}

interface Account {
  id: string;
  orgId: string;
  accountCode: string;
  title: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  normalBalance: 'DEBIT' | 'CREDIT';
  status: 'ACTIVE' | 'INACTIVE';
}
```

---

## AGENT A: Backend API & Services

### Objective
Build all backend services and API endpoints for bank feed matching, auto-posting, and reconciliation auto-matching. This agent works independently using the existing database schema.

### Context
- Database schema: ✅ Complete (BankFeedRule, BankAccountMapping, TransactionMatch, enhanced SourceTransaction)
- Backend: NestJS with Prisma on port 3019
- Multi-tenant: All endpoints require `@UseGuards(JwtAuthGuard, TenantGuard)`
- Access orgId via `req.user.currentOrgId`

### Deliverables

#### 1. Create Bank Module Structure
```
backend/src/modules/bank/
├── bank.module.ts
├── bank.controller.ts
├── dto/
│   ├── create-bank-feed-rule.dto.ts
│   ├── update-bank-feed-rule.dto.ts
│   ├── create-bank-mapping.dto.ts
│   └── match-batch.dto.ts
└── services/
    ├── matching.service.ts
    ├── auto-post.service.ts
    └── recon-auto-match.service.ts
```

#### 2. Matching Service
**File:** `backend/src/modules/bank/services/matching.service.ts`

Core logic:
- Takes a transaction ID
- Fetches all active rules for org (ordered by priority DESC)
- Evaluates each rule against transaction:
  - `EXACT_MERCHANT`: merchantName === pattern (case-insensitive)
  - `CONTAINS_TEXT`: name or merchantName includes pattern
  - `REGEX_PATTERN`: regex.test(name || merchantName)
  - `CATEGORY_MATCH`: Plaid categories overlap with rule categories
  - `AMOUNT_RANGE`: amount between min/max
- Returns confidence: HIGH (exact match), MEDIUM (contains/regex), LOW (category/amount)
- Updates transaction: status='MATCHED', matchedRuleId, matchConfidence, accountId
- Updates rule: matchCount++, lastMatchedAt
- Creates TransactionMatch record
- If autoPost=true AND confidence=HIGH: calls AutoPostService

```typescript
@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  async matchTransaction(transactionId: string, orgId: string): Promise<void> {
    const transaction = await this.prisma.sourceTransaction.findUnique({
      where: { id: transactionId },
      include: { plaidAccount: true }
    });

    if (!transaction) throw new NotFoundException('Transaction not found');

    const rules = await this.prisma.bankFeedRule.findMany({
      where: { orgId, isActive: true },
      orderBy: { priority: 'desc' }
    });

    let bestMatch: { rule: any; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } | null = null;

    for (const rule of rules) {
      const match = this.evaluateRule(transaction, rule);
      if (match && (!bestMatch || this.compareConfidence(match.confidence, bestMatch.confidence) > 0)) {
        bestMatch = { rule, confidence: match.confidence };
      }
    }

    if (bestMatch) {
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

      await this.prisma.bankFeedRule.update({
        where: { id: bestMatch.rule.id },
        data: {
          matchCount: { increment: 1 },
          lastMatchedAt: new Date()
        }
      });

      await this.prisma.transactionMatch.create({
        data: {
          sourceTransactionId: transactionId,
          suggestedAccountId: bestMatch.rule.assignToAccountId,
          confidence: bestMatch.confidence,
          matchReason: `Rule: ${bestMatch.rule.name}`,
          ruleId: bestMatch.rule.id
        }
      });

      // Auto-post if configured
      if (bestMatch.rule.autoPost && bestMatch.confidence === 'HIGH') {
        const autoPostService = new AutoPostService(this.prisma);
        await autoPostService.createJournalFromTransaction(transactionId, orgId);
      }
    }
  }

  private evaluateRule(transaction: any, rule: any): { confidence: 'HIGH' | 'MEDIUM' | 'LOW' } | null {
    const amount = Math.abs(parseFloat(transaction.amount.toString()));

    switch (rule.matchType) {
      case 'EXACT_MERCHANT':
        if (transaction.merchantName?.toLowerCase() === rule.merchantPattern?.toLowerCase()) {
          return { confidence: 'HIGH' };
        }
        break;

      case 'CONTAINS_TEXT':
        const pattern = rule.descriptionPattern?.toLowerCase();
        if (pattern && (
          transaction.name?.toLowerCase().includes(pattern) ||
          transaction.merchantName?.toLowerCase().includes(pattern)
        )) {
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
          const txCategories = transaction.category || [];
          const hasMatch = rule.categoryPatterns.some(cat =>
            txCategories.some(txCat => txCat.toLowerCase().includes(cat.toLowerCase()))
          );
          if (hasMatch) return { confidence: 'LOW' };
        }
        break;

      case 'AMOUNT_RANGE':
        if (rule.amountMin && rule.amountMax) {
          const min = parseFloat(rule.amountMin.toString());
          const max = parseFloat(rule.amountMax.toString());
          if (amount >= min && amount <= max) {
            return { confidence: 'LOW' };
          }
        }
        break;
    }

    return null;
  }

  private compareConfidence(a: string, b: string): number {
    const order = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return order[a] - order[b];
  }
}
```

#### 3. Auto-Post Service
**File:** `backend/src/modules/bank/services/auto-post.service.ts`

Core logic:
- Takes transaction ID
- Requires transaction to have accountId assigned
- Gets BankAccountMapping to find GL cash account
- Creates journal entry with 2 lines:
  - Line 1: Bank account (debit if money in, credit if money out)
  - Line 2: Expense/Revenue account (opposite)
- Links transaction to journal via SourceToJournalLine
- Creates LedgerPostings for both lines
- Updates transaction status to POSTED

```typescript
@Injectable()
export class AutoPostService {
  constructor(private prisma: PrismaService) {}

  async createJournalFromTransaction(transactionId: string, orgId: string): Promise<string> {
    const transaction = await this.prisma.sourceTransaction.findUnique({
      where: { id: transactionId },
      include: { plaidAccount: true, matchedRule: true }
    });

    if (!transaction || !transaction.accountId) {
      throw new BadRequestException('Transaction must have an assigned account');
    }

    // Get bank account mapping
    const mapping = await this.prisma.bankAccountMapping.findUnique({
      where: {
        orgId_plaidAccountId: {
          orgId,
          plaidAccountId: transaction.plaidAccountId
        }
      }
    });

    if (!mapping) {
      throw new BadRequestException('Bank account not mapped to GL account');
    }

    const amount = parseFloat(transaction.amount.toString());
    const isMoneyOut = amount < 0; // Negative = expense/payment
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
        createdById: transaction.reviewedByUserId || 'system',
        postedById: transaction.reviewedByUserId || 'system',
        lines: {
          create: [
            // Line 1: Bank/Cash account
            {
              lineNumber: 1,
              accountId: mapping.glAccountId,
              debitAmount: isMoneyOut ? null : absAmount,
              creditAmount: isMoneyOut ? absAmount : null,
              memo: transaction.memo || transaction.name
            },
            // Line 2: Expense/Revenue account
            {
              lineNumber: 2,
              accountId: transaction.accountId,
              debitAmount: isMoneyOut ? absAmount : null,
              creditAmount: isMoneyOut ? null : absAmount,
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

#### 4. Reconciliation Auto-Match Service
**File:** `backend/src/modules/bank/services/recon-auto-match.service.ts`

Core logic:
- Takes reconciliation session ID
- Gets bank account from session
- Finds BankAccountMapping to get plaidAccountId
- Gets unmatched SourceTransactions for that plaid account (status=POSTED, no reconMatches)
- Gets unmatched JournalLines for that GL account (status=POSTED, no reconMatches)
- For each source transaction:
  - Find best matching journal line by:
    - Exact amount (within $0.01)
    - Date within ±3 days (prefer ±1 day)
    - Description similarity >50% (Levenshtein-based)
  - Create ReconMatch if found
- Returns { matched: number, unmatched: number }

```typescript
@Injectable()
export class ReconAutoMatchService {
  constructor(private prisma: PrismaService) {}

  async autoMatchReconSession(reconSessionId: string, orgId: string): Promise<{
    matched: number;
    unmatched: number;
  }> {
    const session = await this.prisma.reconSession.findUnique({
      where: { id: reconSessionId },
      include: { account: true }
    });

    if (!session) {
      throw new NotFoundException('Reconciliation session not found');
    }

    // Get bank account mapping
    const mapping = await this.prisma.bankAccountMapping.findFirst({
      where: {
        orgId,
        glAccountId: session.accountId
      }
    });

    if (!mapping) {
      throw new BadRequestException('Bank account not mapped to Plaid account');
    }

    // Get unmatched source transactions
    const sourceTransactions = await this.prisma.sourceTransaction.findMany({
      where: {
        orgId,
        plaidAccountId: mapping.plaidAccountId,
        date: { lte: session.statementEndDate },
        status: { in: ['POSTED', 'CATEGORIZED'] },
        reconMatches: { none: {} }
      },
      orderBy: { date: 'asc' }
    });

    // Get unmatched journal lines
    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        accountId: session.accountId,
        journalEntry: {
          orgId,
          status: 'POSTED',
          postingDate: { lte: session.statementEndDate }
        },
        reconMatches: { none: {} }
      },
      include: { journalEntry: true },
      orderBy: { journalEntry: { entryDate: 'asc' } }
    });

    let matchedCount = 0;
    const unmatchedLines = [...journalLines];

    for (const sourceTx of sourceTransactions) {
      const match = this.findBestMatch(sourceTx, unmatchedLines);

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
        const index = unmatchedLines.findIndex(jl => jl.id === match.id);
        if (index > -1) unmatchedLines.splice(index, 1);
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

    // Priority 1: Exact amount + date within 3 days + description similarity
    for (const jl of journalLines) {
      const jlAmount = parseFloat(jl.debitAmount?.toString() || jl.creditAmount?.toString() || '0');
      const jlDate = new Date(jl.journalEntry.entryDate);
      const daysDiff = Math.abs((sourceTxDate.getTime() - jlDate.getTime()) / (1000 * 60 * 60 * 24));

      if (Math.abs(sourceTxAmount - jlAmount) < 0.01 && daysDiff <= 3) {
        const similarity = this.calculateSimilarity(
          sourceTx.name || sourceTx.merchantName,
          jl.memo || jl.journalEntry.description
        );

        if (similarity > 0.5) {
          return jl;
        }
      }
    }

    // Priority 2: Exact amount + date within 7 days
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

  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // Word overlap
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w)).length;

    return commonWords / Math.max(words1.length, words2.length);
  }
}
```

#### 5. Bank Controller
**File:** `backend/src/modules/bank/bank.controller.ts`

All endpoints with guards:

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { MatchingService } from './services/matching.service';
import { AutoPostService } from './services/auto-post.service';
import { ReconAutoMatchService } from './services/recon-auto-match.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBankFeedRuleDto,
  UpdateBankFeedRuleDto,
  CreateBankMappingDto,
  MatchBatchDto,
} from './dto';

@Controller('bank')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BankController {
  constructor(
    private matchingService: MatchingService,
    private autoPostService: AutoPostService,
    private reconAutoMatchService: ReconAutoMatchService,
    private prisma: PrismaService,
  ) {}

  // ===== RULES =====

  @Get('rules')
  async getRules(@Req() req) {
    return this.prisma.bankFeedRule.findMany({
      where: { orgId: req.user.currentOrgId },
      include: { assignToAccount: true },
      orderBy: { priority: 'desc' },
    });
  }

  @Post('rules')
  async createRule(@Req() req, @Body() dto: CreateBankFeedRuleDto) {
    return this.prisma.bankFeedRule.create({
      data: {
        ...dto,
        orgId: req.user.currentOrgId,
      },
    });
  }

  @Put('rules/:id')
  async updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateBankFeedRuleDto,
  ) {
    return this.prisma.bankFeedRule.update({
      where: { id },
      data: dto,
    });
  }

  @Delete('rules/:id')
  async deleteRule(@Param('id') id: string) {
    return this.prisma.bankFeedRule.delete({ where: { id } });
  }

  // ===== TRANSACTIONS =====

  @Get('transactions')
  async getTransactions(@Req() req, @Query('status') status?: string) {
    return this.prisma.sourceTransaction.findMany({
      where: {
        orgId: req.user.currentOrgId,
        ...(status && { status: status as any }),
      },
      include: {
        plaidAccount: true,
        matchedRule: true,
        account: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  @Patch('transactions/:id')
  async updateTransaction(
    @Param('id') id: string,
    @Body() dto: { accountId?: string; memo?: string; status?: string },
  ) {
    return this.prisma.sourceTransaction.update({
      where: { id },
      data: dto,
    });
  }

  @Post('transactions/:id/match')
  async matchTransaction(@Req() req, @Param('id') id: string) {
    await this.matchingService.matchTransaction(id, req.user.currentOrgId);
    return { success: true };
  }

  @Post('transactions/match-batch')
  async matchBatch(@Req() req, @Body() dto: MatchBatchDto) {
    const results = [];
    for (const id of dto.transactionIds) {
      try {
        await this.matchingService.matchTransaction(id, req.user.currentOrgId);
        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }
    return results;
  }

  @Post('transactions/:id/post')
  async postTransaction(@Req() req, @Param('id') id: string) {
    const journalId = await this.autoPostService.createJournalFromTransaction(
      id,
      req.user.currentOrgId,
    );
    return { journalId };
  }

  @Post('transactions/post-batch')
  async postBatch(@Req() req, @Body() dto: MatchBatchDto) {
    const results = [];
    for (const id of dto.transactionIds) {
      try {
        const journalId = await this.autoPostService.createJournalFromTransaction(
          id,
          req.user.currentOrgId,
        );
        results.push({ id, journalId, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }
    return results;
  }

  // ===== MAPPINGS =====

  @Get('mappings')
  async getMappings(@Req() req) {
    return this.prisma.bankAccountMapping.findMany({
      where: { orgId: req.user.currentOrgId },
      include: {
        glAccount: true,
        defaultOffsetAccount: true,
      },
    });
  }

  @Post('mappings')
  async createMapping(@Req() req, @Body() dto: CreateBankMappingDto) {
    return this.prisma.bankAccountMapping.create({
      data: {
        ...dto,
        orgId: req.user.currentOrgId,
      },
    });
  }

  @Put('mappings/:id')
  async updateMapping(
    @Param('id') id: string,
    @Body() dto: Partial<CreateBankMappingDto>,
  ) {
    return this.prisma.bankAccountMapping.update({
      where: { id },
      data: dto,
    });
  }

  @Delete('mappings/:id')
  async deleteMapping(@Param('id') id: string) {
    return this.prisma.bankAccountMapping.delete({ where: { id } });
  }

  // ===== RECONCILIATION =====

  @Post('reconciliation/:sessionId/auto-match')
  async autoMatchRecon(@Req() req, @Param('sessionId') sessionId: string) {
    return this.reconAutoMatchService.autoMatchReconSession(
      sessionId,
      req.user.currentOrgId,
    );
  }
}
```

#### 6. DTOs
**File:** `backend/src/modules/bank/dto/index.ts`

```typescript
import { IsString, IsBoolean, IsNumber, IsOptional, IsArray, IsEnum } from 'class-validator';

export class CreateBankFeedRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsEnum(['EXACT_MERCHANT', 'CONTAINS_TEXT', 'REGEX_PATTERN', 'AMOUNT_RANGE', 'CATEGORY_MATCH', 'COMBINED'])
  matchType: string;

  @IsOptional()
  @IsString()
  merchantPattern?: string;

  @IsOptional()
  @IsString()
  descriptionPattern?: string;

  @IsOptional()
  @IsArray()
  categoryPatterns?: string[];

  @IsOptional()
  @IsNumber()
  amountMin?: number;

  @IsOptional()
  @IsNumber()
  amountMax?: number;

  @IsString()
  assignToAccountId: string;

  @IsOptional()
  @IsString()
  defaultMemo?: string;

  @IsOptional()
  @IsBoolean()
  autoPost?: boolean;

  @IsOptional()
  dimensionValues?: any;
}

export class UpdateBankFeedRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  merchantPattern?: string;

  @IsOptional()
  @IsString()
  descriptionPattern?: string;

  @IsOptional()
  @IsArray()
  categoryPatterns?: string[];

  @IsOptional()
  @IsNumber()
  amountMin?: number;

  @IsOptional()
  @IsNumber()
  amountMax?: number;

  @IsOptional()
  @IsString()
  assignToAccountId?: string;

  @IsOptional()
  @IsString()
  defaultMemo?: string;

  @IsOptional()
  @IsBoolean()
  autoPost?: boolean;
}

export class CreateBankMappingDto {
  @IsString()
  plaidAccountId: string;

  @IsString()
  glAccountId: string;

  @IsOptional()
  @IsBoolean()
  enableAutoPosting?: boolean;

  @IsOptional()
  @IsString()
  defaultOffsetAccountId?: string;
}

export class MatchBatchDto {
  @IsArray()
  @IsString({ each: true })
  transactionIds: string[];
}
```

#### 7. Module Setup
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
  providers: [MatchingService, AutoPostService, ReconAutoMatchService],
  exports: [MatchingService, AutoPostService, ReconAutoMatchService],
})
export class BankModule {}
```

#### 8. Register in App Module
**File:** `backend/src/app.module.ts`

Add to imports:
```typescript
import { BankModule } from './modules/bank/bank.module';

@Module({
  imports: [
    // ... existing modules
    BankModule,
  ],
  // ...
})
```

#### 9. Enhance Plaid Service (Optional - trigger matching on sync)
**File:** `backend/src/modules/plaid/plaid.service.ts`

Add after transaction sync:
```typescript
// In syncTransactions method, after creating SourceTransaction records:
for (const transaction of newTransactions) {
  await this.matchingService.matchTransaction(transaction.id, orgId);
}
```

### Success Criteria
- [ ] All 15+ API endpoints respond with correct data
- [ ] Matching engine evaluates rules by priority
- [ ] Auto-posting creates journal entries with correct debits/credits
- [ ] Reconciliation auto-match finds matches based on date/amount/description
- [ ] All endpoints are multi-tenant isolated
- [ ] Batch operations handle errors gracefully

---

## AGENT B: Frontend UI & Components

### Objective
Build comprehensive React frontend for bank feeds management including transaction review, rules management, and reconciliation. Works independently using the API contract.

### Context
- Next.js 16 (App Router) with TypeScript on port 3020
- Backend API: `http://localhost:3019/api`
- Tailwind CSS + shadcn/ui components
- JWT auth via `api.ts` client

### Deliverables

#### 1. Enhanced Bank Feeds Page
**File:** `src/app/(dashboard)/bank-feeds/page.tsx`

4-tab layout:
- Transactions (default)
- Bank Accounts
- Matching Rules
- Reconciliation

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { TransactionList } from '@/components/bank/transaction-list';
import { BankAccountsList } from '@/components/bank/bank-accounts-list';
import { RulesManager } from '@/components/bank/rules-manager';
import { ReconciliationPanel } from '@/components/bank/reconciliation-panel';

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
          <TransactionList />
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

#### 2. Transaction List Component
**File:** `src/components/bank/transaction-list.tsx`

Features:
- Filter by status (PENDING, MATCHED, CATEGORIZED, POSTED)
- Inline editing (account assignment, memo)
- Batch selection
- Batch operations (Match Selected, Post Selected)
- Status badges with confidence indicators

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Check, X, ChevronRight } from 'lucide-react';

export function TransactionList() {
  const [transactions, setTransactions] = useState([]);
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
        api.getBankTransactions(filter),
        api.getChartOfAccounts(),
      ]);
      setTransactions(txs);
      setAccounts(accts);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchBatch = async () => {
    await api.matchTransactionBatch(selected);
    setSelected([]);
    loadData();
  };

  const handlePostBatch = async () => {
    await api.postTransactionBatch(selected);
    setSelected([]);
    loadData();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selected.length === transactions.length) {
      setSelected([]);
    } else {
      setSelected(transactions.map((t) => t.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters and Batch Actions */}
      <div className="flex items-center justify-between">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="MATCHED">Matched</SelectItem>
            <SelectItem value="CATEGORIZED">Categorized</SelectItem>
            <SelectItem value="POSTED">Posted</SelectItem>
          </SelectContent>
        </Select>

        {selected.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-600">
              {selected.length} selected
            </span>
            <Button size="sm" variant="outline" onClick={handleMatchBatch}>
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

      {/* Transaction Table */}
      <div className="bg-white rounded-lg border border-zinc-200">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="w-12 p-3">
                <Checkbox checked={selected.length === transactions.length} onCheckedChange={toggleSelectAll} />
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

        {transactions.length === 0 && !loading && (
          <div className="p-8 text-center text-zinc-500">
            No {filter.toLowerCase()} transactions found
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionRow({ transaction, accounts, isSelected, onToggleSelect, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [accountId, setAccountId] = useState(transaction.accountId || '');
  const [memo, setMemo] = useState(transaction.memo || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateTransaction(transaction.id, {
        accountId,
        memo,
        status: 'CATEGORIZED',
      });
      setEditing(false);
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = () => {
    const variants = {
      PENDING: 'bg-gray-100 text-gray-800',
      MATCHED: 'bg-blue-100 text-blue-800',
      CATEGORIZED: 'bg-yellow-100 text-yellow-800',
      POSTED: 'bg-green-100 text-green-800',
      EXCLUDED: 'bg-red-100 text-red-800',
    };

    return (
      <div className="flex items-center gap-2">
        <Badge className={variants[transaction.status]}>
          {transaction.status}
        </Badge>
        {transaction.matchConfidence && (
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              transaction.matchConfidence === 'HIGH'
                ? 'bg-green-50 text-green-700'
                : transaction.matchConfidence === 'MEDIUM'
                ? 'bg-yellow-50 text-yellow-700'
                : 'bg-gray-50 text-gray-700'
            }`}
          >
            {transaction.matchConfidence}
          </span>
        )}
      </div>
    );
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
            <div className="text-xs text-zinc-500">
              {memo || transaction.name}
            </div>
          )}
        </div>
      </td>
      <td className="p-3 text-sm text-zinc-600">
        {transaction.plaidAccount?.name}
      </td>
      <td className="p-3 text-sm text-right font-medium">
        <span
          className={
            transaction.amount < 0 ? 'text-red-600' : 'text-green-600'
          }
        >
          ${Math.abs(transaction.amount).toFixed(2)}
        </span>
      </td>
      <td className="p-3">
        {editing ? (
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select account..." />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.accountCode} - {acc.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="text-sm text-zinc-700">
            {accounts.find((a) => a.id === accountId)?.title || '—'}
          </div>
        )}
      </td>
      <td className="p-3">{getStatusBadge()}</td>
      <td className="p-3">
        {editing ? (
          <div className="flex gap-1">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}
```

#### 3. Rules Manager Component
**File:** `src/components/bank/rules-manager.tsx`

Features:
- List all rules with priority sorting
- Create/Edit/Delete rules
- Toggle active status
- Show match statistics

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { RuleEditorDialog } from './rule-editor-dialog';

export function RulesManager() {
  const [rules, setRules] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const data = await api.getBankFeedRules();
    setRules(data);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this rule?')) {
      await api.deleteBankFeedRule(id);
      loadRules();
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await api.updateBankFeedRule(id, { isActive: !isActive });
    loadRules();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">
            Matching Rules
          </h2>
          <p className="text-sm text-zinc-600">
            Create rules to automatically categorize bank transactions
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingRule(null);
            setShowDialog(true);
          }}
        >
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
              <th className="text-center p-3 text-sm font-medium">
                Auto-Post
              </th>
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
                  <div className="text-sm font-medium text-zinc-900">
                    {rule.name}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {rule.description}
                  </div>
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
                    onCheckedChange={() =>
                      handleToggleActive(rule.id, rule.isActive)
                    }
                  />
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingRule(rule);
                        setShowDialog(true);
                      }}
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
          onSave={() => {
            setShowDialog(false);
            loadRules();
          }}
        />
      )}
    </div>
  );
}
```

#### 4. Rule Editor Dialog
**File:** `src/components/bank/rule-editor-dialog.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export function RuleEditorDialog({ rule, onClose, onSave }) {
  const [accounts, setAccounts] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 0,
    matchType: 'CONTAINS_TEXT',
    merchantPattern: '',
    descriptionPattern: '',
    assignToAccountId: '',
    defaultMemo: '',
    autoPost: false,
    ...rule,
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const data = await api.getChartOfAccounts();
    setAccounts(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rule) {
      await api.updateBankFeedRule(rule.id, formData);
    } else {
      await api.createBankFeedRule(formData);
    }
    onSave();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Rule' : 'New Rule'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Rule Name</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          <div>
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Priority</Label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: +e.target.value })
                }
              />
            </div>

            <div>
              <Label>Match Type</Label>
              <Select
                value={formData.matchType}
                onValueChange={(value) =>
                  setFormData({ ...formData, matchType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXACT_MERCHANT">
                    Exact Merchant
                  </SelectItem>
                  <SelectItem value="CONTAINS_TEXT">Contains Text</SelectItem>
                  <SelectItem value="REGEX_PATTERN">Regex Pattern</SelectItem>
                  <SelectItem value="CATEGORY_MATCH">
                    Category Match
                  </SelectItem>
                  <SelectItem value="AMOUNT_RANGE">Amount Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(formData.matchType === 'EXACT_MERCHANT' ||
            formData.matchType === 'CONTAINS_TEXT') && (
            <div>
              <Label>Merchant/Description Pattern</Label>
              <Input
                value={
                  formData.merchantPattern || formData.descriptionPattern
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    merchantPattern: e.target.value,
                    descriptionPattern: e.target.value,
                  })
                }
                placeholder="e.g., Amazon, Starbucks, Office Depot"
              />
            </div>
          )}

          {formData.matchType === 'REGEX_PATTERN' && (
            <div>
              <Label>Regex Pattern</Label>
              <Input
                value={formData.descriptionPattern}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    descriptionPattern: e.target.value,
                  })
                }
                placeholder="e.g., ^AMAZON.*"
              />
            </div>
          )}

          <div>
            <Label>Assign to Account</Label>
            <Select
              value={formData.assignToAccountId}
              onValueChange={(value) =>
                setFormData({ ...formData, assignToAccountId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.accountCode} - {acc.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Default Memo</Label>
            <Input
              value={formData.defaultMemo}
              onChange={(e) =>
                setFormData({ ...formData, defaultMemo: e.target.value })
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={formData.autoPost}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, autoPost: checked })
              }
            />
            <Label>Auto-Post (for high-confidence matches)</Label>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600">
              Save Rule
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

#### 5. Reconciliation Panel Component
**File:** `src/components/bank/reconciliation-panel.tsx`

```typescript
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function ReconciliationPanel() {
  const [sessionId, setSessionId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAutoMatch = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const data = await api.autoMatchReconciliation(sessionId);
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">
          Reconciliation Auto-Match
        </h2>
        <p className="text-sm text-zinc-600">
          Automatically match bank feed transactions to journal entries
        </p>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-700">
              Reconciliation Session ID
            </label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded-md"
              placeholder="Enter session ID..."
            />
          </div>

          <Button
            onClick={handleAutoMatch}
            disabled={!sessionId || loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? 'Matching...' : 'Auto-Match Transactions'}
          </Button>

          {result && (
            <div className="mt-4 p-4 bg-emerald-50 rounded-md border border-emerald-200">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-sm text-zinc-600">Matched</div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {result.matched}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-zinc-600">Unmatched</div>
                  <div className="text-2xl font-bold text-zinc-600">
                    {result.unmatched}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### 6. API Client Methods
**File:** `src/lib/api.ts`

Add these methods to the API class:

```typescript
// Bank Feed Rules
async getBankFeedRules(): Promise<any[]> {
  return this.request('/bank/rules');
}

async createBankFeedRule(data: any): Promise<any> {
  return this.request('/bank/rules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async updateBankFeedRule(id: string, data: any): Promise<any> {
  return this.request(`/bank/rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async deleteBankFeedRule(id: string): Promise<void> {
  return this.request(`/bank/rules/${id}`, { method: 'DELETE' });
}

// Bank Transactions
async getBankTransactions(status?: string): Promise<any[]> {
  return this.request(`/bank/transactions${status ? `?status=${status}` : ''}`);
}

async updateTransaction(id: string, data: any): Promise<any> {
  return this.request(`/bank/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

async matchTransaction(id: string): Promise<void> {
  return this.request(`/bank/transactions/${id}/match`, { method: 'POST' });
}

async matchTransactionBatch(transactionIds: string[]): Promise<any> {
  return this.request('/bank/transactions/match-batch', {
    method: 'POST',
    body: JSON.stringify({ transactionIds }),
  });
}

async postTransaction(id: string): Promise<{ journalId: string }> {
  return this.request(`/bank/transactions/${id}/post`, { method: 'POST' });
}

async postTransactionBatch(transactionIds: string[]): Promise<any> {
  return this.request('/bank/transactions/post-batch', {
    method: 'POST',
    body: JSON.stringify({ transactionIds }),
  });
}

// Bank Account Mappings
async getBankMappings(): Promise<any[]> {
  return this.request('/bank/mappings');
}

async createBankMapping(data: any): Promise<any> {
  return this.request('/bank/mappings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Reconciliation
async autoMatchReconciliation(sessionId: string): Promise<{ matched: number; unmatched: number }> {
  return this.request(`/bank/reconciliation/${sessionId}/auto-match`, {
    method: 'POST',
  });
}
```

#### 7. Bank Accounts List (Placeholder)
**File:** `src/components/bank/bank-accounts-list.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PlaidLinkButton } from './plaid-link-button';

export function BankAccountsList() {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const data = await api.getPlaidAccounts();
    setAccounts(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Connected Bank Accounts</h2>
        <PlaidLinkButton
          onSuccess={() => loadAccounts()}
          onError={(err) => console.error(err)}
        />
      </div>

      <div className="grid gap-4">
        {accounts.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-lg border border-zinc-200 p-4"
          >
            <h3 className="font-semibold">{item.plaidInstitutionName}</h3>
            <div className="mt-2 space-y-1">
              {item.accounts.map((acc) => (
                <div key={acc.id} className="text-sm text-zinc-600">
                  {acc.name} - {acc.mask ? `****${acc.mask}` : 'No mask'}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Success Criteria
- [ ] Transaction list displays with filtering and inline editing
- [ ] Batch operations work (match/post selected)
- [ ] Rules manager allows CRUD operations
- [ ] Status badges show confidence levels
- [ ] Reconciliation panel triggers auto-match
- [ ] All API calls handle errors gracefully

---

## AGENT C: Integration Testing & Documentation

### Objective
Create comprehensive integration tests, E2E tests, and documentation for the bank feeds system. Works independently based on API contract and expected behavior.

### Context
- Backend: NestJS with Prisma
- Frontend: Next.js 16
- Test Framework: Jest (backend), Playwright (frontend)
- Can start immediately using API contract

### Deliverables

#### 1. Backend Integration Tests
**File:** `backend/test/bank-feed-integration.spec.ts`

Test scenarios:
- Rule creation and matching
- Transaction matching by different rule types
- Auto-posting journal entries
- Reconciliation auto-matching
- Batch operations
- Multi-tenant isolation

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
        email: 'bank-test@example.com',
        passwordHash: await hashPassword('password'),
        name: 'Test User',
      },
    });

    const org = await prisma.org.create({
      data: { name: 'Test Org', slug: 'test-org' },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role: 'admin',
      },
    });

    orgId = org.id;

    // Login to get token
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'bank-test@example.com', password: 'password' });

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
      cashAccount = await prisma.account.create({
        data: {
          orgId,
          accountCode: '1000',
          title: 'Cash',
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
          closingType: 'NON_CLOSING',
        },
      });

      expenseAccount = await prisma.account.create({
        data: {
          orgId,
          accountCode: '5000',
          title: 'Office Supplies',
          accountType: 'EXPENSE',
          normalBalance: 'DEBIT',
          closingType: 'CLOSING',
        },
      });

      sourceTransaction = await prisma.sourceTransaction.create({
        data: {
          orgId,
          plaidTransactionId: 'test-tx-' + Date.now(),
          plaidAccountId: 'test-plaid-account',
          amount: -50.0,
          date: new Date(),
          name: 'Office Depot',
          merchantName: 'Office Depot',
          status: 'PENDING',
          rawJson: {},
          category: ['Shops', 'Office Supplies'],
        },
      });
    });

    it('should create a matching rule', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Office Supplies Rule',
          matchType: 'CONTAINS_TEXT',
          descriptionPattern: 'Office Depot',
          assignToAccountId: expenseAccount.id,
          priority: 10,
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Office Supplies Rule');
    });

    it('should match transaction using CONTAINS_TEXT rule', async () => {
      // Create rule
      const rule = await request(app.getHttpServer())
        .post('/api/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Office Rule',
          matchType: 'CONTAINS_TEXT',
          descriptionPattern: 'Office',
          assignToAccountId: expenseAccount.id,
          priority: 10,
        });

      // Match transaction
      await request(app.getHttpServer())
        .post(`/api/bank/transactions/${sourceTransaction.id}/match`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Verify matched
      const matched = await prisma.sourceTransaction.findUnique({
        where: { id: sourceTransaction.id },
      });

      expect(matched.status).toBe('MATCHED');
      expect(matched.accountId).toBe(expenseAccount.id);
      expect(matched.matchedRuleId).toBe(rule.body.id);
    });

    it('should auto-post high-confidence matched transaction', async () => {
      // Create bank mapping
      await prisma.bankAccountMapping.create({
        data: {
          orgId,
          plaidAccountId: 'test-plaid-account',
          glAccountId: cashAccount.id,
        },
      });

      // Create auto-post rule
      await request(app.getHttpServer())
        .post('/api/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Auto-Post Office',
          matchType: 'EXACT_MERCHANT',
          merchantPattern: 'Office Depot',
          assignToAccountId: expenseAccount.id,
          autoPost: true,
          priority: 10,
        });

      // Match transaction
      await request(app.getHttpServer())
        .post(`/api/bank/transactions/${sourceTransaction.id}/match`)
        .set('Authorization', `Bearer ${authToken}`);

      // Verify posted
      const posted = await prisma.sourceTransaction.findUnique({
        where: { id: sourceTransaction.id },
        include: { journalEntry: true },
      });

      expect(posted.status).toBe('POSTED');
      expect(posted.journalEntry).toBeDefined();
      expect(posted.journalEntry.status).toBe('POSTED');
    });

    it('should batch match multiple transactions', async () => {
      // Create second transaction
      const tx2 = await prisma.sourceTransaction.create({
        data: {
          orgId,
          plaidTransactionId: 'test-tx2-' + Date.now(),
          plaidAccountId: 'test-plaid-account',
          amount: -30.0,
          date: new Date(),
          name: 'Office Max',
          merchantName: 'Office Max',
          status: 'PENDING',
          rawJson: {},
          category: [],
        },
      });

      // Create rule
      await request(app.getHttpServer())
        .post('/api/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Office Rule',
          matchType: 'CONTAINS_TEXT',
          descriptionPattern: 'Office',
          assignToAccountId: expenseAccount.id,
          priority: 10,
        });

      // Batch match
      const response = await request(app.getHttpServer())
        .post('/api/bank/transactions/match-batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionIds: [sourceTransaction.id, tx2.id],
        })
        .expect(201);

      expect(response.body.length).toBe(2);
      expect(response.body.every((r) => r.success)).toBe(true);
    });
  });

  describe('Reconciliation Auto-Match', () => {
    it('should auto-match source transaction to journal line', async () => {
      // Setup accounts
      const cashAccount = await prisma.account.create({
        data: {
          orgId,
          accountCode: '1001',
          title: 'Checking',
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
          closingType: 'NON_CLOSING',
        },
      });

      const expAccount = await prisma.account.create({
        data: {
          orgId,
          accountCode: '5001',
          title: 'Utilities',
          accountType: 'EXPENSE',
          normalBalance: 'DEBIT',
          closingType: 'CLOSING',
        },
      });

      // Create source transaction
      const sourceTx = await prisma.sourceTransaction.create({
        data: {
          orgId,
          plaidTransactionId: 'recon-tx-' + Date.now(),
          plaidAccountId: 'recon-plaid-acct',
          amount: -100.0,
          date: new Date(),
          name: 'Electric Company',
          status: 'POSTED',
          rawJson: {},
          category: [],
        },
      });

      // Create journal entry
      const journalType = await prisma.journalType.create({
        data: {
          orgId,
          code: 'GJ',
          name: 'General Journal',
          book: 'Accrual',
        },
      });

      const journalEntry = await prisma.journalEntry.create({
        data: {
          orgId,
          journalTypeId: journalType.id,
          entryDate: new Date(),
          description: 'Electric Company Payment',
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
                creditAmount: 100.0,
                memo: 'Electric',
              },
              {
                lineNumber: 2,
                accountId: expAccount.id,
                debitAmount: 100.0,
                memo: 'Electric',
              },
            ],
          },
        },
      });

      // Create bank mapping
      await prisma.bankAccountMapping.create({
        data: {
          orgId,
          plaidAccountId: 'recon-plaid-acct',
          glAccountId: cashAccount.id,
        },
      });

      // Create recon session
      const reconSession = await prisma.reconSession.create({
        data: {
          orgId,
          accountId: cashAccount.id,
          statementBeginningBalance: 1000.0,
          statementEndingBalance: 900.0,
          statementEndDate: new Date(),
          status: 'draft',
        },
      });

      // Trigger auto-match
      const response = await request(app.getHttpServer())
        .post(`/api/bank/reconciliation/${reconSession.id}/auto-match`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.matched).toBeGreaterThan(0);

      // Verify match created
      const matches = await prisma.reconMatch.findMany({
        where: { reconSessionId: reconSession.id },
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].sourceTransactionId).toBe(sourceTx.id);
    });
  });
});
```

#### 2. Frontend E2E Tests
**File:** `tests/bank-feeds.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Bank Feeds E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3020/login');
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');
  });

  test('should display bank feeds page', async ({ page }) => {
    await page.goto('http://localhost:3020/bank-feeds');
    await expect(page.locator('h1:has-text("Bank Feeds")')).toBeVisible();
    await expect(page.locator('text=Transactions')).toBeVisible();
    await expect(page.locator('text=Matching Rules')).toBeVisible();
  });

  test('should create a matching rule', async ({ page }) => {
    await page.goto('http://localhost:3020/bank-feeds');
    await page.click('text=Matching Rules');
    await page.click('button:has-text("New Rule")');

    // Fill form
    await page.fill('[name="name"]', 'Test Auto Rule');
    await page.fill('[name="description"]', 'Test description');
    await page.selectOption('select[name="matchType"]', 'CONTAINS_TEXT');
    await page.fill('input[placeholder*="Amazon"]', 'Amazon');

    // Select account (assumes dropdown is populated)
    await page.click('button:has-text("Select account")');
    await page.click('text=Office Supplies');

    await page.click('button:has-text("Save")');

    await expect(page.locator('text=Test Auto Rule')).toBeVisible();
  });

  test('should filter transactions by status', async ({ page }) => {
    await page.goto('http://localhost:3020/bank-feeds');

    // Click filter
    await page.click('button:has-text("Pending")');
    await page.click('text=Matched');

    await expect(page.locator('select')).toHaveValue('MATCHED');
  });

  test('should match and post transaction', async ({ page }) => {
    await page.goto('http://localhost:3020/bank-feeds');

    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Select first transaction
    await page.click('table tbody tr:first-child input[type="checkbox"]');

    // Match
    await page.click('button:has-text("Match Selected")');
    await page.waitForTimeout(1000);

    // Verify status changed
    // (In real test, would check for MATCHED badge)

    // Post
    await page.click('table tbody tr:first-child input[type="checkbox"]');
    await page.click('button:has-text("Post Selected")');
    await page.waitForTimeout(1000);
  });

  test('should edit transaction inline', async ({ page }) => {
    await page.goto('http://localhost:3020/bank-feeds');

    await page.waitForSelector('table tbody tr');

    // Click edit button
    await page.click('table tbody tr:first-child button[aria-label="Edit"]');

    // Change memo
    await page.fill('input[placeholder="Add memo..."]', 'Test memo');

    // Select account
    await page.click('button:has-text("Select account")');
    await page.click('text=Office Supplies');

    // Save
    await page.click('button[aria-label="Save"]');

    await page.waitForTimeout(500);
  });
});
```

#### 3. API Documentation
**File:** `docs/API_REFERENCE.md`

```markdown
# Bank Feeds API Reference

## Authentication
All endpoints require JWT Bearer token with `currentOrgId` in payload.

Headers:
```
Authorization: Bearer <token>
```

## Endpoints

### Bank Feed Rules

#### List Rules
```
GET /api/bank/rules
```

Response:
```json
[
  {
    "id": "rule_123",
    "orgId": "org_456",
    "name": "Office Supplies",
    "description": "Match office supply purchases",
    "priority": 10,
    "isActive": true,
    "matchType": "CONTAINS_TEXT",
    "descriptionPattern": "Office Depot",
    "assignToAccountId": "acc_789",
    "autoPost": false,
    "matchCount": 42,
    "lastMatchedAt": "2025-02-04T10:30:00Z",
    "assignToAccount": {
      "id": "acc_789",
      "accountCode": "5000",
      "title": "Office Supplies"
    }
  }
]
```

#### Create Rule
```
POST /api/bank/rules
Content-Type: application/json
```

Body:
```json
{
  "name": "Amazon Purchases",
  "description": "Auto-categorize Amazon",
  "priority": 5,
  "matchType": "EXACT_MERCHANT",
  "merchantPattern": "Amazon",
  "assignToAccountId": "acc_789",
  "autoPost": true
}
```

#### Update Rule
```
PUT /api/bank/rules/:id
Content-Type: application/json
```

Body: Same as create (all fields optional)

#### Delete Rule
```
DELETE /api/bank/rules/:id
```

### Transactions

#### List Transactions
```
GET /api/bank/transactions?status=PENDING
```

Query params:
- `status` (optional): PENDING, MATCHED, CATEGORIZED, POSTED, EXCLUDED

Response:
```json
[
  {
    "id": "tx_123",
    "orgId": "org_456",
    "plaidAccountId": "plaid_789",
    "amount": -50.00,
    "date": "2025-02-03",
    "name": "Office Depot",
    "merchantName": "Office Depot",
    "status": "MATCHED",
    "matchConfidence": "HIGH",
    "accountId": "acc_789",
    "memo": "Office supplies",
    "plaidAccount": {
      "id": "plaid_789",
      "name": "Checking ****1234"
    }
  }
]
```

#### Update Transaction
```
PATCH /api/bank/transactions/:id
Content-Type: application/json
```

Body:
```json
{
  "accountId": "acc_789",
  "memo": "Updated memo",
  "status": "CATEGORIZED"
}
```

#### Match Transaction
```
POST /api/bank/transactions/:id/match
```

Response:
```json
{
  "success": true
}
```

#### Match Batch
```
POST /api/bank/transactions/match-batch
Content-Type: application/json
```

Body:
```json
{
  "transactionIds": ["tx_1", "tx_2", "tx_3"]
}
```

Response:
```json
[
  { "id": "tx_1", "success": true },
  { "id": "tx_2", "success": true },
  { "id": "tx_3", "success": false, "error": "No matching rule found" }
]
```

#### Post Transaction
```
POST /api/bank/transactions/:id/post
```

Response:
```json
{
  "journalId": "je_123"
}
```

#### Post Batch
```
POST /api/bank/transactions/post-batch
Content-Type: application/json
```

Body: Same as match-batch

### Bank Account Mappings

#### List Mappings
```
GET /api/bank/mappings
```

#### Create Mapping
```
POST /api/bank/mappings
Content-Type: application/json
```

Body:
```json
{
  "plaidAccountId": "plaid_789",
  "glAccountId": "acc_cash_123",
  "enableAutoPosting": true,
  "defaultOffsetAccountId": "acc_exp_456"
}
```

### Reconciliation

#### Auto-Match Reconciliation
```
POST /api/bank/reconciliation/:sessionId/auto-match
```

Response:
```json
{
  "matched": 15,
  "unmatched": 3
}
```

## Error Responses

All endpoints return errors in this format:
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

Common status codes:
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden (multi-tenant violation)
- 404: Not Found
- 500: Internal Server Error
```

#### 4. User Guide
**File:** `docs/USER_GUIDE.md`

```markdown
# Bank Feeds System - User Guide

## Overview
Automatically import, categorize, and post bank transactions using Plaid integration.

## Quick Start

### 1. Connect Your Bank
1. Go to **Bank Feeds** → **Bank Accounts**
2. Click **Connect Bank Account**
3. Search for your bank in Plaid modal
4. Enter credentials and authorize

### 2. Map Bank Account to GL
1. After connecting, go to **Bank Feeds** → **Bank Accounts**
2. Click **Map to GL Account** next to your bank
3. Select the corresponding Cash/Bank account from chart of accounts

### 3. Create Matching Rules
1. Go to **Bank Feeds** → **Matching Rules**
2. Click **New Rule**
3. Configure:
   - **Name**: Descriptive name (e.g., "Amazon Purchases")
   - **Priority**: Higher = evaluated first (0-100)
   - **Match Type**:
     - Exact Merchant: Matches merchant name exactly
     - Contains Text: Description contains text
     - Regex Pattern: Advanced pattern matching
     - Category Match: Matches Plaid categories
     - Amount Range: Amount between min/max
   - **Pattern**: What to match (e.g., "Amazon", "Starbucks")
   - **Assign to Account**: GL account to categorize to
   - **Auto-Post**: Automatically create journal entry for high-confidence matches

### 4. Review Transactions
1. Go to **Bank Feeds** → **Transactions**
2. Filter by status:
   - **Pending**: Not yet reviewed
   - **Matched**: Auto-matched by rule
   - **Categorized**: Manually assigned
   - **Posted**: Journal entry created
3. For each transaction:
   - Click edit icon to assign category manually
   - Add memo for context
   - Select multiple and click "Match Selected" to apply rules
   - Select multiple and click "Post Selected" to create journal entries

### 5. Reconcile
1. Go to **Bank Feeds** → **Reconciliation**
2. Enter reconciliation session ID
3. Click **Auto-Match**
4. System matches bank transactions to journal lines based on:
   - Exact amount
   - Date within ±3 days
   - Description similarity

## Best Practices

### Rule Priority
- Exact merchant rules: Priority 90-100
- Contains text rules: Priority 50-89
- Category rules: Priority 10-49
- Amount range rules: Priority 1-9

### Auto-Posting
Only enable auto-post for:
- Exact merchant matches
- High-confidence rules
- Recurring transactions

### Reconciliation
- Run auto-match before manual reconciliation
- Review unmatched items for errors
- Create adjusting entries for differences

## Troubleshooting

**Q: Transaction not matching any rule?**
- Check rule is active
- Verify pattern matches transaction name/merchant
- Check rule priority (higher priority rules evaluated first)

**Q: Auto-post not working?**
- Ensure bank account is mapped to GL account
- Verify rule has autoPost=true
- Check match confidence is HIGH

**Q: Reconciliation not matching?**
- Verify bank account mapping exists
- Check date range (matches within ±7 days)
- Ensure amounts match exactly
```

### Success Criteria
- [ ] Backend integration tests cover all endpoints
- [ ] Frontend E2E tests cover main workflows
- [ ] API documentation is complete
- [ ] User guide explains all features
- [ ] Tests pass in CI/CD pipeline

---

## Execution Plan

All 3 agents work **in parallel**:

1. **Agent A** (Backend): 3-4 days
   - Services, controllers, DTOs
   - Can start immediately

2. **Agent B** (Frontend): 3-4 days
   - UI components, API client
   - Can start immediately (using API contract)

3. **Agent C** (Testing/Docs): 2-3 days
   - Tests, documentation
   - Can start immediately (using API contract and expected behavior)

**Total Timeline: 3-4 days** (parallel execution)

## Integration Points

- Frontend calls backend via API contract
- Tests validate both frontend and backend
- Documentation covers end-to-end workflows

All agents have everything they need to work independently!
