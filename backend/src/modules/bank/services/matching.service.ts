import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { MatchConfidence, RuleMatchType, SourceTransactionStatus } from '@prisma/client';

/**
 * Match result containing match details and whether auto-post should trigger
 */
export interface MatchResult {
  matched: boolean;
  transactionId: string;
  ruleId?: string;
  ruleName?: string;
  confidence?: MatchConfidence;
  shouldAutoPost: boolean;
}

@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Match a single transaction against all active rules
   * Priority: Exact merchant > Contains text > Regex > Category > Amount range
   * Returns match result including whether auto-post should be triggered
   */
  async matchTransaction(transactionId: string, orgId: string): Promise<MatchResult> {
    const transaction = await this.prisma.sourceTransaction.findUnique({
      where: { id: transactionId },
      include: { plaidAccount: true },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Get all active rules sorted by priority
    const rules = await this.prisma.bankFeedRule.findMany({
      where: { orgId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    let bestMatch: { rule: any; confidence: MatchConfidence } | null = null;

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
          status: SourceTransactionStatus.MATCHED,
          accountId: bestMatch.rule.assignToAccountId,
          memo: bestMatch.rule.defaultMemo || transaction.name,
        },
      });

      // Update rule stats
      await this.prisma.bankFeedRule.update({
        where: { id: bestMatch.rule.id },
        data: {
          matchCount: { increment: 1 },
          lastMatchedAt: new Date(),
        },
      });

      // Create match suggestion
      await this.prisma.transactionMatch.create({
        data: {
          sourceTransactionId: transactionId,
          suggestedAccountId: bestMatch.rule.assignToAccountId,
          confidence: bestMatch.confidence,
          matchReason: `Rule: ${bestMatch.rule.name}`,
          ruleId: bestMatch.rule.id,
        },
      });

      // Determine if auto-post should trigger
      const shouldAutoPost = bestMatch.rule.autoPost && bestMatch.confidence === MatchConfidence.HIGH;

      return {
        matched: true,
        transactionId,
        ruleId: bestMatch.rule.id,
        ruleName: bestMatch.rule.name,
        confidence: bestMatch.confidence,
        shouldAutoPost,
      };
    }

    return { matched: false, transactionId, shouldAutoPost: false };
  }

  private async evaluateRule(transaction: any, rule: any): Promise<{ confidence: MatchConfidence } | null> {
    const amount = Math.abs(parseFloat(transaction.amount.toString()));

    switch (rule.matchType) {
      case RuleMatchType.EXACT_MERCHANT:
        if (transaction.merchantName?.toLowerCase() === rule.merchantPattern?.toLowerCase()) {
          return { confidence: MatchConfidence.HIGH };
        }
        break;

      case RuleMatchType.CONTAINS_TEXT:
        const pattern = rule.descriptionPattern?.toLowerCase();
        if (pattern && (
          transaction.name?.toLowerCase().includes(pattern) ||
          transaction.merchantName?.toLowerCase().includes(pattern)
        )) {
          return { confidence: MatchConfidence.MEDIUM };
        }
        break;

      case RuleMatchType.REGEX_PATTERN:
        if (rule.descriptionPattern) {
          try {
            const regex = new RegExp(rule.descriptionPattern, 'i');
            if (regex.test(transaction.name) || regex.test(transaction.merchantName || '')) {
              return { confidence: MatchConfidence.MEDIUM };
            }
          } catch (error) {
            console.error('Invalid regex pattern:', rule.descriptionPattern);
          }
        }
        break;

      case RuleMatchType.CATEGORY_MATCH:
        if (rule.categoryPatterns?.length > 0) {
          const txCategories = transaction.category || [];
          const hasMatch = rule.categoryPatterns.some(cat =>
            txCategories.some(txCat => txCat.toLowerCase().includes(cat.toLowerCase()))
          );
          if (hasMatch) return { confidence: MatchConfidence.LOW };
        }
        break;

      case RuleMatchType.AMOUNT_RANGE:
        if (rule.amountMin && rule.amountMax) {
          const min = parseFloat(rule.amountMin.toString());
          const max = parseFloat(rule.amountMax.toString());
          if (amount >= min && amount <= max) {
            return { confidence: MatchConfidence.LOW };
          }
        }
        break;

      case RuleMatchType.COMBINED:
        // For COMBINED, evaluate multiple conditions
        let hasMatch = false;
        let confidenceLevel: MatchConfidence = MatchConfidence.LOW;

        // Check merchant pattern
        if (rule.merchantPattern && transaction.merchantName?.toLowerCase() === rule.merchantPattern?.toLowerCase()) {
          hasMatch = true;
          confidenceLevel = MatchConfidence.HIGH;
        }

        // Check description pattern
        if (rule.descriptionPattern) {
          const descPattern = rule.descriptionPattern.toLowerCase();
          if (transaction.name?.toLowerCase().includes(descPattern) ||
              transaction.merchantName?.toLowerCase().includes(descPattern)) {
            hasMatch = true;
            if (confidenceLevel !== MatchConfidence.HIGH) {
              confidenceLevel = MatchConfidence.MEDIUM;
            }
          }
        }

        // Check amount range
        if (rule.amountMin && rule.amountMax && hasMatch) {
          const min = parseFloat(rule.amountMin.toString());
          const max = parseFloat(rule.amountMax.toString());
          if (amount >= min && amount <= max) {
            return { confidence: confidenceLevel };
          }
          hasMatch = false; // Amount doesn't match, so combined rule fails
        }

        if (hasMatch) {
          return { confidence: confidenceLevel };
        }
        break;
    }

    return null;
  }

  private compareConfidence(a: MatchConfidence, b: MatchConfidence): number {
    const order = {
      [MatchConfidence.HIGH]: 3,
      [MatchConfidence.MEDIUM]: 2,
      [MatchConfidence.LOW]: 1
    };
    return order[a] - order[b];
  }

  /**
   * Batch match multiple transactions
   * Returns array of match results including which ones should be auto-posted
   */
  async matchTransactionBatch(
    transactionIds: string[],
    orgId: string,
  ): Promise<{ results: MatchResult[]; autoPostIds: string[] }> {
    const results: MatchResult[] = [];
    const autoPostIds: string[] = [];

    for (const id of transactionIds) {
      try {
        const result = await this.matchTransaction(id, orgId);
        results.push(result);
        if (result.shouldAutoPost) {
          autoPostIds.push(id);
        }
      } catch (error) {
        results.push({
          matched: false,
          transactionId: id,
          shouldAutoPost: false,
        });
      }
    }

    return { results, autoPostIds };
  }
}
