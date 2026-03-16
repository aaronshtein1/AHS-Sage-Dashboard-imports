import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { JournalService } from '../journal/journal.service';
import {
  QueryTransactionsDto,
  CategorizeTransactionDto,
  CreateJournalFromTransactionDto,
  TransactionStatus,
} from './dto';
import { PaginatedResponse } from '../../common/types';

@Injectable()
export class BankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
  ) {}

  async getTransactions(
    orgId: string,
    query: QueryTransactionsDto,
  ): Promise<PaginatedResponse<any>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 50;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = { orgId };

    if (query.plaidAccountId) {
      where.plaidAccountId = query.plaidAccountId;
    }

    if (query.accountId) {
      where.accountId = query.accountId;
    }

    if (query.startDate) {
      where.date = { ...where.date, gte: new Date(query.startDate) };
    }

    if (query.endDate) {
      where.date = { ...where.date, lte: new Date(query.endDate) };
    }

    // Filter by status - use actual SourceTransactionStatus enum values
    if (query.status) {
      const statusUpperCase = query.status.toUpperCase();
      // Handle SourceTransactionStatus enum values
      if (['PENDING', 'MATCHED', 'CATEGORIZED', 'POSTED', 'EXCLUDED'].includes(statusUpperCase)) {
        where.status = statusUpperCase;
      } else if (query.status === TransactionStatus.UNCATEGORIZED) {
        where.accountId = null;
      } else if (query.status === TransactionStatus.CATEGORIZED) {
        where.accountId = { not: null };
        where.journalEntryId = null;
      } else if (query.status === TransactionStatus.JOURNALED) {
        where.journalEntryId = { not: null };
      }
    }

    const [total, transactions] = await Promise.all([
      this.prisma.sourceTransaction.count({ where }),
      this.prisma.sourceTransaction.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          plaidAccount: {
            include: {
              plaidItem: true,
            },
          },
        },
      }),
    ]);

    return {
      data: transactions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async categorizeTransaction(
    orgId: string,
    userId: string,
    transactionId: string,
    dto: CategorizeTransactionDto,
  ) {
    const transaction = await this.prisma.sourceTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.orgId !== orgId) {
      throw new BadRequestException('Transaction does not belong to this organization');
    }

    if (transaction.journalEntryId) {
      throw new BadRequestException('Transaction has already been journalized');
    }

    // Validate account exists and belongs to org
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });

    if (!account || account.orgId !== orgId) {
      throw new BadRequestException('Invalid account');
    }

    // Validate dimensions if provided
    if (dto.dimensions && dto.dimensions.length > 0) {
      for (const dim of dto.dimensions) {
        const dimensionValue = await this.prisma.dimensionValue.findUnique({
          where: { id: dim.dimensionValueId },
          include: { dimensionType: true },
        });

        if (!dimensionValue || dimensionValue.dimensionType.orgId !== orgId) {
          throw new BadRequestException('Invalid dimension value');
        }

        if (dimensionValue.dimensionTypeId !== dim.dimensionTypeId) {
          throw new BadRequestException('Dimension value does not match dimension type');
        }
      }
    }

    const updated = await this.prisma.sourceTransaction.update({
      where: { id: transactionId },
      data: {
        accountId: dto.accountId,
        memo: dto.memo,
        categorizedAt: new Date(),
        categorizedBy: userId,
      },
      include: {
        plaidAccount: {
          include: {
            plaidItem: true,
          },
        },
      },
    });

    return updated;
  }

  async createJournalFromTransaction(
    orgId: string,
    userId: string,
    transactionId: string,
    dto?: CreateJournalFromTransactionDto,
  ) {
    const transaction = await this.prisma.sourceTransaction.findUnique({
      where: { id: transactionId },
      include: {
        plaidAccount: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.orgId !== orgId) {
      throw new BadRequestException('Transaction does not belong to this organization');
    }

    if (!transaction.accountId) {
      throw new BadRequestException('Transaction must be categorized before creating a journal');
    }

    if (transaction.journalEntryId) {
      throw new BadRequestException('Transaction has already been journalized');
    }

    // Get or create default BANK journal type
    let journalType = await this.prisma.journalType.findFirst({
      where: {
        orgId,
        code: dto?.journalTypeCode || 'BANK',
      },
    });

    if (!journalType) {
      // Create default BANK journal type if it doesn't exist
      journalType = await this.prisma.journalType.create({
        data: {
          orgId,
          code: 'BANK',
          name: 'Bank Transactions',
          description: 'Journal entries from bank transactions',
        },
      });
    }

    // Determine if transaction is a debit or credit to the cash account
    // Positive amounts in Plaid = money out (credit to cash, debit to expense)
    // Negative amounts in Plaid = money in (debit to cash, credit to revenue)
    const isMoneyOut = parseFloat(transaction.amount.toString()) > 0;

    // Get the bank/cash account from the plaid account mapping
    // For now, we'll assume a default cash account - this should be configurable
    let cashAccountId: string;
    const cashAccount = await this.prisma.account.findFirst({
      where: {
        orgId,
        accountCode: { startsWith: '1010' }, // Common cash account code
        accountType: 'ASSET',
      },
    });

    if (!cashAccount) {
      throw new BadRequestException(
        'No cash account found. Please create a cash account with code starting with 1010.',
      );
    }

    cashAccountId = cashAccount.id;

    const entryDate = dto?.entryDate
      ? new Date(dto.entryDate)
      : transaction.date;

    const description =
      dto?.description ||
      `${transaction.name}${transaction.merchantName ? ' - ' + transaction.merchantName : ''}`;

    const amount = Math.abs(parseFloat(transaction.amount.toString()));

    // Create journal entry with two lines
    const journalEntry = await this.journalService.createJournalEntry(orgId, userId, {
      journalTypeId: journalType.id,
      entryDate: entryDate.toISOString(),
      description,
      referenceNumber: transaction.plaidTransactionId || transaction.id,
      lines: [
        // Line 1: Cash account
        {
          accountId: cashAccountId,
          debitAmount: isMoneyOut ? undefined : amount.toString(),
          creditAmount: isMoneyOut ? amount.toString() : undefined,
          memo: transaction.memo || undefined,
        },
        // Line 2: Expense/Revenue account (from categorization)
        {
          accountId: transaction.accountId!,
          debitAmount: isMoneyOut ? amount.toString() : undefined,
          creditAmount: isMoneyOut ? undefined : amount.toString(),
          memo: transaction.memo || undefined,
        },
      ],
    });

    // Link source transaction to journal entry
    await this.prisma.sourceTransaction.update({
      where: { id: transactionId },
      data: {
        journalEntryId: journalEntry.id,
      },
    });

    // Create link records for each journal line
    for (const line of journalEntry.lines) {
      await this.prisma.sourceToJournalLine.create({
        data: {
          sourceTransactionId: transactionId,
          journalLineId: line.id,
        },
      });
    }

    return journalEntry;
  }
}
