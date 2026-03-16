import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { BankService } from './bank.service';
import {
  QueryTransactionsDto,
  CategorizeTransactionDto,
  CreateJournalFromTransactionDto,
  CreateBankFeedRuleDto,
  UpdateBankFeedRuleDto,
  CreateBankMappingDto,
  UpdateBankMappingDto,
  MatchBatchDto,
} from './dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentOrg } from '../../decorators/current-org.decorator';
import type { OrgContext } from '../../common/types';
import { MatchingService } from './services/matching.service';
import { AutoPostService } from './services/auto-post.service';
import { ReconAutoMatchService } from './services/recon-auto-match.service';
import { RuleSuggestionService } from './services/rule-suggestion.service';
import { PrismaService } from '../../common/prisma.service';

@Controller('bank')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BankController {
  constructor(
    private readonly bankService: BankService,
    private readonly matchingService: MatchingService,
    private readonly autoPostService: AutoPostService,
    private readonly reconAutoMatchService: ReconAutoMatchService,
    private readonly ruleSuggestionService: RuleSuggestionService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('transactions')
  async getTransactions(
    @CurrentOrg() orgContext: OrgContext,
    @Query() query: QueryTransactionsDto,
  ) {
    return this.bankService.getTransactions(orgContext.orgId, query);
  }

  @Post('transactions/:id/categorize')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async categorizeTransaction(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') transactionId: string,
    @Body() dto: CategorizeTransactionDto,
  ) {
    return this.bankService.categorizeTransaction(
      orgContext.orgId,
      orgContext.userId,
      transactionId,
      dto,
    );
  }

  @Post('transactions/:id/create-journal')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async createJournal(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') transactionId: string,
    @Body() dto?: CreateJournalFromTransactionDto,
  ) {
    return this.bankService.createJournalFromTransaction(
      orgContext.orgId,
      orgContext.userId,
      transactionId,
      dto,
    );
  }

  // ===== BANK FEED RULES =====

  @Get('rules')
  async getRules(@CurrentOrg() orgContext: OrgContext) {
    return this.prisma.bankFeedRule.findMany({
      where: { orgId: orgContext.orgId },
      include: { assignToAccount: true },
      orderBy: { priority: 'desc' },
    });
  }

  @Post('rules')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async createRule(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: CreateBankFeedRuleDto,
  ) {
    return this.prisma.bankFeedRule.create({
      data: {
        ...dto,
        orgId: orgContext.orgId,
      },
    });
  }

  @Put('rules/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
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
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async deleteRule(@Param('id') id: string) {
    return this.prisma.bankFeedRule.delete({ where: { id } });
  }

  // ===== AI-POWERED RULE SUGGESTIONS =====

  /**
   * Get AI-powered rule suggestions for unmatched transactions
   */
  @Get('suggestions')
  async getRuleSuggestions(
    @CurrentOrg() orgContext: OrgContext,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.ruleSuggestionService.getSuggestionsForUnmatchedTransactions(
      orgContext.orgId,
      limitNum,
    );
  }

  /**
   * Get AI-powered rule suggestions for specific transactions
   */
  @Post('suggestions/analyze')
  async analyzeTransactions(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: { transactionIds: string[] },
  ) {
    return this.ruleSuggestionService.getSuggestionsForTransactions(
      dto.transactionIds,
      orgContext.orgId,
    );
  }

  /**
   * Create a rule from an AI suggestion
   */
  @Post('suggestions/create-rule')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async createRuleFromSuggestion(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: {
      transactionId: string;
      merchantName: string | null;
      transactionName: string;
      suggestedCategory: string;
      matchedPattern: string;
      suggestedRule: {
        name: string;
        matchType: string;
        pattern: string;
        autoPost: boolean;
      };
      accountId?: string;
      autoPost?: boolean;
    },
  ) {
    return this.ruleSuggestionService.createRuleFromSuggestion(
      dto as any,
      orgContext.orgId,
      dto.accountId,
      dto.autoPost,
    );
  }

  // ===== TRANSACTION MATCHING & POSTING =====

  @Post('transactions/:id/match')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async matchTransaction(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    const result = await this.matchingService.matchTransaction(id, orgContext.orgId);

    // Auto-post if the rule is configured for it and confidence is HIGH
    if (result.shouldAutoPost) {
      try {
        const journalId = await this.autoPostService.createJournalFromTransaction(id, orgContext.orgId);
        return { success: true, matched: result.matched, autoPosted: true, journalId };
      } catch (error) {
        console.error('Auto-post failed for transaction', id, error);
        return { success: true, matched: result.matched, autoPosted: false, autoPostError: error.message };
      }
    }

    return { success: true, matched: result.matched, autoPosted: false };
  }

  @Post('transactions/match-batch')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async matchBatch(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: MatchBatchDto,
  ) {
    const { results, autoPostIds } = await this.matchingService.matchTransactionBatch(
      dto.transactionIds,
      orgContext.orgId,
    );

    // Auto-post transactions that matched rules with autoPost=true and HIGH confidence
    const autoPostResults: { id: string; success: boolean; journalId?: string; error?: string }[] = [];
    if (autoPostIds.length > 0) {
      const postResults = await this.autoPostService.postTransactionBatch(autoPostIds, orgContext.orgId);
      for (const result of postResults) {
        autoPostResults.push(result);
      }
    }

    return {
      matchResults: results,
      autoPosted: autoPostResults,
      summary: {
        totalMatched: results.filter(r => r.matched).length,
        totalAutoPosted: autoPostResults.filter(r => r.success).length,
      },
    };
  }

  @Post('transactions/:id/post')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async postTransaction(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    const journalId = await this.autoPostService.createJournalFromTransaction(
      id,
      orgContext.orgId,
    );
    return { journalId };
  }

  @Post('transactions/post-batch')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async postBatch(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: MatchBatchDto,
  ) {
    return this.autoPostService.postTransactionBatch(
      dto.transactionIds,
      orgContext.orgId,
    );
  }

  @Patch('transactions/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async updateTransaction(
    @Param('id') id: string,
    @Body() dto: { accountId?: string; memo?: string; status?: any },
  ) {
    const updateData: any = {};
    if (dto.accountId !== undefined) updateData.accountId = dto.accountId;
    if (dto.memo !== undefined) updateData.memo = dto.memo;
    if (dto.status !== undefined) updateData.status = dto.status;

    return this.prisma.sourceTransaction.update({
      where: { id },
      data: updateData,
    });
  }

  // ===== BANK ACCOUNT MAPPINGS =====

  @Get('mappings')
  async getMappings(@CurrentOrg() orgContext: OrgContext) {
    return this.prisma.bankAccountMapping.findMany({
      where: { orgId: orgContext.orgId },
      include: {
        glAccount: true,
        defaultOffsetAccount: true,
      },
    });
  }

  @Post('mappings')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async createMapping(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: CreateBankMappingDto,
  ) {
    return this.prisma.bankAccountMapping.create({
      data: {
        ...dto,
        orgId: orgContext.orgId,
      },
    });
  }

  @Put('mappings/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async updateMapping(
    @Param('id') id: string,
    @Body() dto: UpdateBankMappingDto,
  ) {
    return this.prisma.bankAccountMapping.update({
      where: { id },
      data: dto,
    });
  }

  @Delete('mappings/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async deleteMapping(@Param('id') id: string) {
    return this.prisma.bankAccountMapping.delete({ where: { id } });
  }

  // ===== RECONCILIATION AUTO-MATCH =====

  @Post('reconciliation/:sessionId/auto-match')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async autoMatchRecon(
    @CurrentOrg() orgContext: OrgContext,
    @Param('sessionId') sessionId: string,
  ) {
    return this.reconAutoMatchService.autoMatchReconSession(
      sessionId,
      orgContext.orgId,
    );
  }
}
