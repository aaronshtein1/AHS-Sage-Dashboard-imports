import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { createHash } from 'crypto';
import {
  JournalEntry,
  JournalLine,
  Prisma,
  AuditAction,
} from '@prisma/client';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

// Status constants since they might be strings in the schema
const JournalStatus = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
} as const;

const PeriodStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;

export interface PostingResult {
  success: boolean;
  journalEntryId: string;
  entryNumber?: string;
  postingHash?: string;
  reversalEntryId?: string;
  reversalEntryNumber?: string;
  error?: string;
}

interface ValidationError {
  field: string;
  message: string;
}

@Injectable()
export class PostingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Post a journal entry to the ledger
   * This is the core posting engine that enforces all accounting rules
   */
  async postJournal(
    journalEntryId: string,
    userId: string,
    orgId: string,
    isAdjusting: boolean = false,
  ): Promise<PostingResult> {
    // Use a transaction for atomicity
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch the journal entry with all related data
      const journalEntry = await tx.journalEntry.findUnique({
        where: { id: journalEntryId },
        include: {
          journalType: true,
          lines: {
            include: {
              account: {
                include: {
                  requiredDimensions: {
                    include: { dimensionType: true },
                  },
                },
              },
              dimensions: true,
            },
          },
        },
      });

      if (!journalEntry) {
        throw new BadRequestException('Journal entry not found');
      }

      if (journalEntry.orgId !== orgId) {
        throw new ForbiddenException('Journal entry does not belong to this organization');
      }

      if (journalEntry.status !== JournalStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot post journal with status: ${journalEntry.status}`,
        );
      }

      // 2. Validate the journal balances (debits == credits)
      const balanceErrors = this.validateBalance(journalEntry.lines);
      if (balanceErrors.length > 0) {
        throw new BadRequestException({
          message: 'Journal entry does not balance',
          errors: balanceErrors,
        });
      }

      // 3. Validate period is OPEN (or ADJ type for closed periods)
      const postingDate = journalEntry.entryDate;
      const period = await tx.period.findFirst({
        where: {
          orgId,
          startDate: { lte: postingDate },
          endDate: { gte: postingDate },
        },
      });

      if (!period) {
        throw new BadRequestException(
          `No accounting period found for date: ${postingDate.toISOString().split('T')[0]}`,
        );
      }

      if (period.status === PeriodStatus.CLOSED) {
        // Only ADJ journal type can post to closed periods
        const isAdjustingEntry = journalEntry.journalType.code === 'ADJ' || isAdjusting;
        if (!isAdjustingEntry) {
          throw new BadRequestException(
            `Cannot post to closed period: ${period.name}. Use an Adjusting Journal (ADJ) type.`,
          );
        }
      }

      // 4. Validate required dimensions per account
      const dimensionErrors = this.validateRequiredDimensions(journalEntry.lines);
      if (dimensionErrors.length > 0) {
        throw new BadRequestException({
          message: 'Missing required dimensions',
          errors: dimensionErrors,
        });
      }

      // 5. Check accounts allow direct posting
      const disallowedAccounts = journalEntry.lines.filter(
        (line) => line.account.disallowDirectPosting,
      );
      if (disallowedAccounts.length > 0) {
        throw new BadRequestException({
          message: 'Some accounts do not allow direct posting',
          accounts: disallowedAccounts.map((l) => l.account.accountCode),
        });
      }

      // 6. Create immutable ledger posting rows
      const postingHash = this.generatePostingHash(journalEntry, postingDate);

      const ledgerPostings = journalEntry.lines.map((line) => ({
        orgId,
        journalEntryId: journalEntry.id,
        accountId: line.accountId,
        postingDate,
        debitAmount: line.debitAmount || new Decimal(0),
        creditAmount: line.creditAmount || new Decimal(0),
      }));

      await tx.ledgerPosting.createMany({ data: ledgerPostings });

      // 7. Update journal entry status
      const now = new Date();
      await tx.journalEntry.update({
        where: { id: journalEntryId },
        data: {
          status: JournalStatus.POSTED,
          postedBy: userId,
          postedAt: now,
        },
      });

      // 8. Create audit event
      await tx.auditEvent.create({
        data: {
          orgId,
          userId,
          action: AuditAction.JOURNAL_POSTED,
          entityType: 'journal_entry',
          entityId: journalEntryId,
          newData: {
            entryNumber: journalEntry.entryNumber,
            postedAt: now.toISOString(),
            postingHash,
          },
        },
      });

      return {
        success: true,
        journalEntryId,
        entryNumber: journalEntry.entryNumber,
        postingHash,
      };
    });
  }

  /**
   * Unpost a journal entry (revert back to draft without creating a reversal)
   * This simply removes the ledger postings and sets status back to DRAFT
   */
  async unpostJournal(
    journalEntryId: string,
    userId: string,
    orgId: string,
  ): Promise<PostingResult> {
    return this.prisma.$transaction(async (tx) => {
      const journalEntry = await tx.journalEntry.findUnique({
        where: { id: journalEntryId },
        include: {
          journalType: true,
        },
      });

      if (!journalEntry) {
        throw new BadRequestException('Journal entry not found');
      }

      if (journalEntry.orgId !== orgId) {
        throw new ForbiddenException('Journal entry does not belong to this organization');
      }

      if (journalEntry.status !== JournalStatus.POSTED) {
        throw new BadRequestException(
          `Cannot unpost journal with status: ${journalEntry.status}. Only POSTED journals can be unposted.`,
        );
      }

      // Delete ledger postings for this journal entry
      await tx.ledgerPosting.deleteMany({
        where: { journalEntryId },
      });

      // Revert journal entry status back to DRAFT
      await tx.journalEntry.update({
        where: { id: journalEntryId },
        data: {
          status: JournalStatus.DRAFT,
          postedBy: null,
          postedAt: null,
        },
      });

      // Create audit event
      await tx.auditEvent.create({
        data: {
          orgId,
          userId,
          action: AuditAction.JOURNAL_REVERSED, // Using REVERSED as closest action type
          entityType: 'journal_entry',
          entityId: journalEntryId,
          newData: {
            entryNumber: journalEntry.entryNumber,
            unpostedAt: new Date().toISOString(),
            action: 'UNPOSTED',
          },
        },
      });

      return {
        success: true,
        journalEntryId,
        entryNumber: journalEntry.entryNumber,
      };
    });
  }

  /**
   * Reverse a posted journal entry
   */
  async reverseJournal(
    journalEntryId: string,
    userId: string,
    orgId: string,
    reversalDate?: Date,
  ): Promise<PostingResult> {
    return this.prisma.$transaction(async (tx) => {
      const originalEntry = await tx.journalEntry.findUnique({
        where: { id: journalEntryId },
        include: {
          journalType: true,
          lines: {
            include: {
              dimensions: true,
            },
          },
        },
      });

      if (!originalEntry) {
        throw new BadRequestException('Journal entry not found');
      }

      if (originalEntry.orgId !== orgId) {
        throw new ForbiddenException('Journal entry does not belong to this organization');
      }

      if (originalEntry.status !== JournalStatus.POSTED) {
        throw new BadRequestException('Can only reverse posted journal entries');
      }

      // Check if already reversed
      const existingReversal = await tx.journalEntry.findFirst({
        where: { reversalEntryId: journalEntryId },
      });

      if (existingReversal) {
        throw new BadRequestException(
          `Journal already reversed by ${existingReversal.entryNumber}`,
        );
      }

      const effectiveReversalDate = reversalDate || new Date();

      // Get the period for the reversal date
      const period = await tx.period.findFirst({
        where: {
          orgId,
          startDate: { lte: effectiveReversalDate },
          endDate: { gte: effectiveReversalDate },
        },
      });

      if (!period) {
        throw new BadRequestException('No period found for reversal date');
      }

      // Generate entry number
      const entryNumber = await this.generateEntryNumber(tx, orgId);

      // Create reversal entry with flipped debits/credits
      const reversalEntry = await tx.journalEntry.create({
        data: {
          orgId,
          journalTypeId: originalEntry.journalTypeId,
          periodId: period.id,
          entryNumber,
          entryDate: effectiveReversalDate,
          description: `Reversal of ${originalEntry.entryNumber}: ${originalEntry.description || ''}`,
          reversalEntryId: journalEntryId,
          status: JournalStatus.DRAFT,
          lines: {
            create: originalEntry.lines.map((line, index) => ({
              lineNumber: index + 1,
              accountId: line.accountId,
              // Flip debits and credits
              debitAmount: line.creditAmount,
              creditAmount: line.debitAmount,
              description: `Reversal: ${line.description || ''}`,
              dimensions: {
                create: line.dimensions.map((dim) => ({
                  dimensionTypeId: dim.dimensionTypeId,
                  dimensionValueId: dim.dimensionValueId,
                })),
              },
            })),
          },
        },
      });

      // Post the reversal
      const postResult = await this.postJournal(reversalEntry.id, userId, orgId);

      // Mark original as reversed
      await tx.journalEntry.update({
        where: { id: journalEntryId },
        data: { status: JournalStatus.REVERSED },
      });

      // Audit event
      await tx.auditEvent.create({
        data: {
          orgId,
          userId,
          action: AuditAction.JOURNAL_REVERSED,
          entityType: 'journal_entry',
          entityId: journalEntryId,
          newData: {
            reversalEntryId: reversalEntry.id,
            reversalEntryNumber: postResult.entryNumber,
          },
        },
      });

      return {
        success: true,
        journalEntryId,
        reversalEntryId: reversalEntry.id,
        reversalEntryNumber: postResult.entryNumber,
        postingHash: postResult.postingHash,
      };
    });
  }

  /**
   * Validate that journal lines balance (total debits == total credits)
   */
  private validateBalance(lines: JournalLine[]): ValidationError[] {
    const errors: ValidationError[] = [];

    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const line of lines) {
      if (line.debitAmount) {
        totalDebits = totalDebits.plus(line.debitAmount);
      }
      if (line.creditAmount) {
        totalCredits = totalCredits.plus(line.creditAmount);
      }

      // Validate each line has debit XOR credit, not both
      if (line.debitAmount && line.creditAmount) {
        const debit = new Decimal(line.debitAmount);
        const credit = new Decimal(line.creditAmount);
        if (!debit.isZero() && !credit.isZero()) {
          errors.push({
            field: `line_${line.lineNumber}`,
            message: 'Line cannot have both debit and credit amounts',
          });
        }
      }
    }

    // Check balance
    if (!totalDebits.equals(totalCredits)) {
      errors.push({
        field: 'balance',
        message: `Journal does not balance. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}, Difference: ${totalDebits.minus(totalCredits).toFixed(2)}`,
      });
    }

    // Check for zero-amount entries
    if (totalDebits.isZero() && totalCredits.isZero()) {
      errors.push({
        field: 'amount',
        message: 'Journal entry cannot have zero total amounts',
      });
    }

    return errors;
  }

  /**
   * Validate that all required dimensions are present for each account
   */
  private validateRequiredDimensions(
    lines: (JournalLine & {
      account: { accountCode: string; requiredDimensions: { dimensionType: { id: string; code: string } }[] };
      dimensions: { dimensionTypeId: string }[];
    })[],
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const line of lines) {
      const requiredTypeIds = line.account.requiredDimensions.map(
        (rd) => rd.dimensionType.id,
      );
      const providedTypeIds = line.dimensions.map((d) => d.dimensionTypeId);

      const missingTypes = requiredTypeIds.filter(
        (typeId) => !providedTypeIds.includes(typeId),
      );

      if (missingTypes.length > 0) {
        const missingNames = line.account.requiredDimensions
          .filter((rd) => missingTypes.includes(rd.dimensionType.id))
          .map((rd) => rd.dimensionType.code);

        errors.push({
          field: `line_${line.lineNumber}`,
          message: `Account ${line.account.accountCode} requires dimensions: ${missingNames.join(', ')}`,
        });
      }
    }

    return errors;
  }

  /**
   * Generate a hash for posting integrity verification
   */
  private generatePostingHash(
    journalEntry: JournalEntry & { lines: JournalLine[] },
    postingDate: Date,
  ): string {
    const data = {
      journalEntryId: journalEntry.id,
      postingDate: postingDate.toISOString(),
      lines: journalEntry.lines.map((l) => ({
        accountId: l.accountId,
        debit: l.debitAmount?.toString() || '0',
        credit: l.creditAmount?.toString() || '0',
      })),
      timestamp: new Date().toISOString(),
    };

    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Calculate trial balance for an organization as of a specific date
   */
  async calculateTrialBalance(
    orgId: string,
    asOfDate: Date,
  ): Promise<{
    rows: {
      accountId: string;
      accountCode: string;
      accountTitle: string;
      accountType: string;
      normalBalance: string;
      debitBalance: Decimal;
      creditBalance: Decimal;
    }[];
    totals: {
      totalDebits: Decimal;
      totalCredits: Decimal;
    };
  }> {
    // Get all accounts
    const accounts = await this.prisma.account.findMany({
      where: { orgId, status: 'ACTIVE' },
      orderBy: { accountCode: 'asc' },
    });

    // Get all ledger postings up to asOfDate
    const postings = await this.prisma.ledgerPosting.findMany({
      where: {
        orgId,
        postingDate: { lte: asOfDate },
      },
    });

    // Aggregate by account
    const balancesByAccount = new Map<
      string,
      { debits: Decimal; credits: Decimal }
    >();

    for (const posting of postings) {
      const current = balancesByAccount.get(posting.accountId) || {
        debits: new Decimal(0),
        credits: new Decimal(0),
      };
      balancesByAccount.set(posting.accountId, {
        debits: current.debits.plus(posting.debitAmount),
        credits: current.credits.plus(posting.creditAmount),
      });
    }

    // Build trial balance rows
    const rows = accounts.map((account) => {
      const balances = balancesByAccount.get(account.id) || {
        debits: new Decimal(0),
        credits: new Decimal(0),
      };

      // Calculate net balance based on normal balance
      const netAmount = balances.debits.minus(balances.credits);

      let debitBalance = new Decimal(0);
      let creditBalance = new Decimal(0);

      if (account.normalBalance === 'DEBIT') {
        if (netAmount.greaterThanOrEqualTo(0)) {
          debitBalance = netAmount;
        } else {
          creditBalance = netAmount.abs();
        }
      } else {
        if (netAmount.lessThanOrEqualTo(0)) {
          creditBalance = netAmount.abs();
        } else {
          debitBalance = netAmount;
        }
      }

      return {
        accountId: account.id,
        accountCode: account.accountCode,
        accountTitle: account.title,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
        debitBalance,
        creditBalance,
      };
    });

    // Calculate totals
    const totals = rows.reduce(
      (acc, row) => ({
        totalDebits: acc.totalDebits.plus(row.debitBalance),
        totalCredits: acc.totalCredits.plus(row.creditBalance),
      }),
      {
        totalDebits: new Decimal(0),
        totalCredits: new Decimal(0),
      },
    );

    // Filter out zero-balance rows
    const nonZeroRows = rows.filter(
      (row) => !row.debitBalance.isZero() || !row.creditBalance.isZero(),
    );

    return {
      rows: nonZeroRows,
      totals,
    };
  }

  /**
   * Generate a unique entry number for a journal entry
   */
  private async generateEntryNumber(
    tx: Prisma.TransactionClient,
    orgId: string,
  ): Promise<string> {
    // Get the current year and month for the prefix
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `JE-${year}${month}-`;

    // Find the highest existing entry number with this prefix
    const lastEntry = await tx.journalEntry.findFirst({
      where: {
        orgId,
        entryNumber: { startsWith: prefix },
      },
      orderBy: { entryNumber: 'desc' },
    });

    let nextNumber = 1;
    if (lastEntry) {
      const match = lastEntry.entryNumber.match(/-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }
}
