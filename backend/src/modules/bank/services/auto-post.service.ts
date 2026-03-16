import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { SourceTransactionStatus } from '@prisma/client';
import * as crypto from 'crypto';

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
        matchedRule: true,
      },
    });

    if (!transaction || !transaction.accountId) {
      throw new BadRequestException('Transaction must have an assigned account');
    }

    // Get bank account mapping to find GL cash account
    if (!transaction.plaidAccountId) {
      throw new BadRequestException('Transaction must have a plaid account ID');
    }

    const mapping = await this.prisma.bankAccountMapping.findUnique({
      where: {
        orgId_plaidAccountId: {
          orgId,
          plaidAccountId: transaction.plaidAccountId,
        },
      },
    });

    if (!mapping) {
      throw new BadRequestException('Bank account not mapped to GL account');
    }

    const amount = parseFloat(transaction.amount.toString());
    const isMoneyOut = amount < 0; // Negative = expense/payment
    const absAmount = Math.abs(amount);

    // Get or create GJ journal type
    let journalType = await this.prisma.journalType.findFirst({
      where: { orgId, code: 'GJ' },
    });

    if (!journalType) {
      journalType = await this.prisma.journalType.create({
        data: {
          orgId,
          code: 'GJ',
          name: 'General Journal',
        },
      });
    }

    // Get or create period for transaction date
    const transactionDate = new Date(transaction.date);
    let period = await this.prisma.period.findFirst({
      where: {
        orgId,
        startDate: { lte: transactionDate },
        endDate: { gte: transactionDate },
      },
    });

    if (!period) {
      // Create a monthly period for this date
      const firstDay = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), 1);
      const lastDay = new Date(transactionDate.getFullYear(), transactionDate.getMonth() + 1, 0);

      period = await this.prisma.period.create({
        data: {
          orgId,
          name: `${transactionDate.toLocaleString('default', { month: 'long' })} ${transactionDate.getFullYear()}`,
          startDate: firstDay,
          endDate: lastDay,
          status: 'OPEN',
        },
      });
    }

    // Generate entry number
    const entryCount = await this.prisma.journalEntry.count({
      where: {
        orgId,
        periodId: period.id,
      },
    });
    const entryNumber = `BF-${String(entryCount + 1).padStart(6, '0')}`;

    // Create journal entry
    const journalEntry = await this.prisma.journalEntry.create({
      data: {
        orgId,
        journalTypeId: journalType.id,
        periodId: period.id,
        entryNumber,
        entryDate: transaction.date,
        description: `Bank Feed: ${transaction.name}`,
        reference: transaction.plaidTransactionId || undefined,
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: transaction.reviewedByUserId || 'system',
        lines: {
          create: [
            // Line 1: Bank/Cash account
            {
              lineNumber: 1,
              accountId: mapping.glAccountId,
              debitAmount: isMoneyOut ? 0 : absAmount,
              creditAmount: isMoneyOut ? absAmount : 0,
              description: transaction.memo || transaction.name,
            },
            // Line 2: Expense/Revenue account
            {
              lineNumber: 2,
              accountId: transaction.accountId,
              debitAmount: isMoneyOut ? absAmount : 0,
              creditAmount: isMoneyOut ? 0 : absAmount,
              description: transaction.memo || transaction.name,
            },
          ],
        },
      },
    });

    // Get the created lines
    const lines = await this.prisma.journalLine.findMany({
      where: { journalEntryId: journalEntry.id },
    });

    // Update transaction status to POSTED
    await this.prisma.sourceTransaction.update({
      where: { id: transactionId },
      data: {
        status: SourceTransactionStatus.POSTED,
        journalEntryId: journalEntry.id,
      },
    });

    // Create source-to-journal-line links
    for (const line of lines) {
      await this.prisma.sourceToJournalLine.create({
        data: {
          sourceTransactionId: transactionId,
          journalLineId: line.id,
        },
      });
    }

    // Create ledger postings
    for (const line of lines) {
      await this.prisma.ledgerPosting.create({
        data: {
          orgId,
          journalEntryId: journalEntry.id,
          accountId: line.accountId,
          postingDate: journalEntry.entryDate,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          runningBalance: 0, // Will be calculated by a separate process
        },
      });
    }

    return journalEntry.id;
  }

  /**
   * Batch post multiple transactions
   */
  async postTransactionBatch(
    transactionIds: string[],
    orgId: string,
  ): Promise<Array<{ id: string; journalId?: string; success: boolean; error?: string }>> {
    const results: Array<{ id: string; journalId?: string; success: boolean; error?: string }> = [];

    for (const id of transactionIds) {
      try {
        const journalId = await this.createJournalFromTransaction(id, orgId);
        results.push({ id, journalId, success: true });
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }
}
