import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';

@Injectable()
export class ReconAutoMatchService {
  constructor(private prisma: PrismaService) {}

  /**
   * Auto-match source transactions to journal lines during reconciliation
   * Matches based on: date, amount, and description similarity
   */
  async autoMatchReconSession(
    reconSessionId: string,
    orgId: string,
  ): Promise<{
    matched: number;
    unmatched: number;
  }> {
    const session = await this.prisma.reconSession.findUnique({
      where: { id: reconSessionId },
      include: { account: true },
    });

    if (!session) {
      throw new NotFoundException('Reconciliation session not found');
    }

    // Get bank account mapping to find associated plaid account
    const mapping = await this.prisma.bankAccountMapping.findFirst({
      where: {
        orgId,
        glAccountId: session.accountId,
      },
    });

    if (!mapping) {
      throw new BadRequestException('Bank account not mapped to Plaid account');
    }

    // Get all unmatched source transactions in the period
    const sourceTransactions = await this.prisma.sourceTransaction.findMany({
      where: {
        orgId,
        plaidAccountId: mapping.plaidAccountId,
        date: {
          lte: session.statementEndDate,
        },
        status: { in: ['POSTED', 'CATEGORIZED'] },
        reconMatches: { none: {} }, // Not already matched
      },
      orderBy: { date: 'asc' },
    });

    // Get all journal lines for this account in the period
    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        accountId: session.accountId,
        journalEntry: {
          orgId,
          status: 'POSTED',
          entryDate: {
            lte: session.statementEndDate,
          },
        },
        reconMatches: { none: {} }, // Not already matched
      },
      include: {
        journalEntry: true,
      },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });

    let matchedCount = 0;
    const unmatchedLines = [...journalLines];

    for (const sourceTx of sourceTransactions) {
      // Try to find matching journal line
      const match = this.findBestMatch(sourceTx, unmatchedLines);

      if (match) {
        await this.prisma.reconMatch.create({
          data: {
            reconSessionId,
            sourceTransactionId: sourceTx.id,
            journalLineId: match.id,
            matchType: 'source_to_journal',
          },
        });

        matchedCount++;

        // Remove matched line from pool
        const index = unmatchedLines.findIndex((jl) => jl.id === match.id);
        if (index > -1) unmatchedLines.splice(index, 1);
      }
    }

    return {
      matched: matchedCount,
      unmatched: sourceTransactions.length - matchedCount,
    };
  }

  private findBestMatch(sourceTx: any, journalLines: any[]): any | null {
    const sourceTxAmount = Math.abs(parseFloat(sourceTx.amount.toString()));
    const sourceTxDate = new Date(sourceTx.date);

    // Priority 1: Exact amount + date within 3 days + description similarity
    for (const jl of journalLines) {
      const jlAmount = parseFloat(
        jl.debitAmount?.toString() || jl.creditAmount?.toString() || '0',
      );
      const jlDate = new Date(jl.journalEntry.entryDate);
      const daysDiff = Math.abs(
        (sourceTxDate.getTime() - jlDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (Math.abs(sourceTxAmount - jlAmount) < 0.01 && daysDiff <= 3) {
        const similarity = this.calculateSimilarity(
          sourceTx.name || sourceTx.merchantName,
          jl.memo || jl.journalEntry.description,
        );

        if (similarity > 0.5) {
          return jl;
        }
      }
    }

    // Priority 2: Exact amount + date within 7 days
    for (const jl of journalLines) {
      const jlAmount = parseFloat(
        jl.debitAmount?.toString() || jl.creditAmount?.toString() || '0',
      );
      const jlDate = new Date(jl.journalEntry.entryDate);
      const daysDiff = Math.abs(
        (sourceTxDate.getTime() - jlDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (Math.abs(sourceTxAmount - jlAmount) < 0.01 && daysDiff <= 7) {
        return jl;
      }
    }

    return null;
  }

  /**
   * Simple similarity score based on word overlap
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // Word overlap
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const commonWords = words1.filter((w) => words2.includes(w)).length;

    return commonWords / Math.max(words1.length, words2.length);
  }
}
