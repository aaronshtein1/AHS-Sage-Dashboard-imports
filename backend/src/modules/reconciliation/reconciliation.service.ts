import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateReconSessionDto, CreateMatchDto, MatchType } from './dto';
import { Prisma, ReconMatch } from '@prisma/client';
import { ReconAutoMatchService } from '../bank/services/recon-auto-match.service';

const Decimal = Prisma.Decimal;
type DecimalType = Prisma.Decimal;

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ReconAutoMatchService))
    private readonly autoMatchService: ReconAutoMatchService,
  ) {}

  async createSession(
    orgId: string,
    userId: string,
    dto: CreateReconSessionDto,
  ) {
    // Validate account exists and belongs to org
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });

    if (!account || account.orgId !== orgId) {
      throw new BadRequestException('Invalid account');
    }

    // Determine beginning balance
    let beginningBalance: DecimalType;
    if (dto.statementBeginningBalance) {
      beginningBalance = new Decimal(dto.statementBeginningBalance);
    } else {
      // Get the most recent finalized session for this account
      const priorSession = await this.prisma.reconSession.findFirst({
        where: {
          orgId,
          accountId: dto.accountId,
          status: 'finalized',
        },
        orderBy: {
          statementEndDate: 'desc',
        },
      });

      if (priorSession) {
        beginningBalance = priorSession.statementEndingBalance;
      } else {
        // No prior session, beginning balance is 0
        beginningBalance = new Decimal(0);
      }
    }

    const session = await this.prisma.reconSession.create({
      data: {
        orgId,
        accountId: dto.accountId,
        statementBeginningBalance: beginningBalance,
        statementEndingBalance: new Decimal(dto.statementEndingBalance),
        statementEndDate: new Date(dto.statementEndDate),
        status: 'draft',
      },
      include: {
        matches: true,
      },
    });

    return session;
  }

  async getSession(orgId: string, sessionId: string) {
    const session = await this.prisma.reconSession.findUnique({
      where: { id: sessionId },
      include: {
        matches: {
          include: {
            sourceTransaction: {
              include: {
                plaidAccount: true,
              },
            },
            journalLine: {
              include: {
                journalEntry: true,
                account: true,
              },
            },
          },
        },
        account: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Reconciliation session not found');
    }

    if (session.orgId !== orgId) {
      throw new BadRequestException('Session does not belong to this organization');
    }

    // Get bank account mapping to find associated plaid account
    const mapping = await this.prisma.bankAccountMapping.findFirst({
      where: {
        orgId,
        glAccountId: session.accountId,
      },
    });

    // Get matched transaction IDs
    const matchedSourceTransactionIds = session.matches
      .filter((m): m is typeof m & { sourceTransactionId: string } => m.sourceTransactionId !== null)
      .map((m) => m.sourceTransactionId);

    const matchedJournalLineIds = session.matches
      .filter((m): m is typeof m & { journalLineId: string } => m.journalLineId !== null)
      .map((m) => m.journalLineId);

    // Get unmatched source transactions (Deposits in Transit)
    // These are bank transactions that have cleared the bank but not yet in our books
    const depositsInTransit = mapping ? await this.prisma.sourceTransaction.findMany({
      where: {
        orgId,
        plaidAccountId: mapping.plaidAccountId,
        date: { lte: session.statementEndDate },
        ...(matchedSourceTransactionIds.length > 0 && { id: { notIn: matchedSourceTransactionIds } }),
      },
      include: {
        plaidAccount: true,
      },
      orderBy: { date: 'asc' },
    }) : [];

    // Get unmatched journal lines (Outstanding Checks)
    // These are transactions in our books that haven't cleared the bank yet
    const outstandingChecks = await this.prisma.journalLine.findMany({
      where: {
        accountId: session.accountId,
        journalEntry: {
          orgId,
          status: 'POSTED',
          entryDate: { lte: session.statementEndDate },
        },
        ...(matchedJournalLineIds.length > 0 && { id: { notIn: matchedJournalLineIds } }),
      },
      include: {
        journalEntry: true,
        account: true,
      },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });

    // Calculate reconciliation summary
    const summary = this.calculateReconciliationSummary(
      session,
      depositsInTransit,
      outstandingChecks,
    );

    return {
      ...session,
      depositsInTransit,
      outstandingChecks,
      summary,
    };
  }

  /**
   * Calculate reconciliation summary showing how bank balance reconciles to book balance
   */
  private calculateReconciliationSummary(
    session: any,
    depositsInTransit: any[],
    outstandingChecks: any[],
  ) {
    // Bank statement balance
    const bankStatementBalance = new Decimal(session.statementEndingBalance);

    // Add deposits in transit (+ for deposits, - for withdrawals)
    let depositsInTransitTotal = new Decimal(0);
    for (const deposit of depositsInTransit) {
      depositsInTransitTotal = depositsInTransitTotal.plus(deposit.amount);
    }

    // Subtract outstanding checks (+ for credits/reductions, - for debits/checks)
    let outstandingChecksTotal = new Decimal(0);
    for (const check of outstandingChecks) {
      const amount = check.debitAmount
        ? new Decimal(check.debitAmount)
        : check.creditAmount
        ? new Decimal(check.creditAmount).negated()
        : new Decimal(0);
      outstandingChecksTotal = outstandingChecksTotal.plus(amount);
    }

    // Adjusted bank balance = Bank balance + Deposits in transit - Outstanding checks
    const adjustedBankBalance = bankStatementBalance
      .plus(depositsInTransitTotal)
      .minus(outstandingChecksTotal);

    // Book balance (sum of all cleared items)
    let bookBalance = new Decimal(session.statementBeginningBalance);
    if (session.matches) {
      for (const match of session.matches) {
        if (match.sourceTransaction) {
          bookBalance = bookBalance.plus(match.sourceTransaction.amount);
        }
      }
    }

    // Difference (should be 0 if reconciled)
    const difference = adjustedBankBalance.minus(bookBalance);

    return {
      bankStatementBalance: bankStatementBalance.toString(),
      depositsInTransitTotal: depositsInTransitTotal.toString(),
      depositsInTransitCount: depositsInTransit.length,
      outstandingChecksTotal: outstandingChecksTotal.toString(),
      outstandingChecksCount: outstandingChecks.length,
      adjustedBankBalance: adjustedBankBalance.toString(),
      bookBalance: bookBalance.toString(),
      difference: difference.toString(),
      isBalanced: difference.abs().lessThan(new Decimal('0.01')),
    };
  }

  async listSessions(orgId: string, accountId?: string) {
    const sessions = await this.prisma.reconSession.findMany({
      where: {
        orgId,
        ...(accountId && { accountId }),
      },
      orderBy: {
        statementEndDate: 'desc',
      },
      include: {
        matches: true,
      },
    });

    return sessions;
  }

  async createMatch(
    orgId: string,
    sessionId: string,
    dto: CreateMatchDto,
  ) {
    const session = await this.prisma.reconSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Reconciliation session not found');
    }

    if (session.orgId !== orgId) {
      throw new BadRequestException('Session does not belong to this organization');
    }

    if (session.status === 'finalized') {
      throw new BadRequestException('Cannot modify a finalized reconciliation session');
    }

    // Validate match type and required fields
    if (dto.matchType === MatchType.SOURCE_TO_JOURNAL) {
      if (!dto.sourceTransactionIds || !dto.journalLineIds) {
        throw new BadRequestException(
          'Source transaction IDs and journal line IDs are required for source-to-journal matches',
        );
      }

      // Validate source transactions exist
      for (const sourceId of dto.sourceTransactionIds) {
        const source = await this.prisma.sourceTransaction.findUnique({
          where: { id: sourceId },
        });

        if (!source || source.orgId !== orgId) {
          throw new BadRequestException(`Invalid source transaction: ${sourceId}`);
        }
      }

      // Create matches
      const matches: ReconMatch[] = [];
      for (const sourceId of dto.sourceTransactionIds) {
        for (const journalLineId of dto.journalLineIds) {
          const match = await this.prisma.reconMatch.create({
            data: {
              reconSessionId: sessionId,
              sourceTransactionId: sourceId,
              journalLineId: journalLineId,
              matchType: dto.matchType,
            },
          });
          matches.push(match);
        }
      }

      return matches;
    } else if (dto.matchType === MatchType.JOURNAL_TO_JOURNAL) {
      if (!dto.journalLineIds || dto.journalLineIds.length < 2) {
        throw new BadRequestException(
          'At least 2 journal line IDs are required for journal-to-journal matches',
        );
      }

      const matches: ReconMatch[] = [];
      for (const journalLineId of dto.journalLineIds) {
        const match = await this.prisma.reconMatch.create({
          data: {
            reconSessionId: sessionId,
            journalLineId: journalLineId,
            matchType: dto.matchType,
          },
        });
        matches.push(match);
      }

      return matches;
    } else if (dto.matchType === MatchType.SOURCE_TO_SOURCE) {
      if (!dto.sourceTransactionIds || dto.sourceTransactionIds.length < 2) {
        throw new BadRequestException(
          'At least 2 source transaction IDs are required for source-to-source matches',
        );
      }

      const matches: ReconMatch[] = [];
      for (const sourceId of dto.sourceTransactionIds) {
        const match = await this.prisma.reconMatch.create({
          data: {
            reconSessionId: sessionId,
            sourceTransactionId: sourceId,
            matchType: dto.matchType,
          },
        });
        matches.push(match);
      }

      return matches;
    }

    throw new BadRequestException('Invalid match type');
  }

  async finalizeSession(
    orgId: string,
    userId: string,
    sessionId: string,
  ) {
    const session = await this.prisma.reconSession.findUnique({
      where: { id: sessionId },
      include: {
        matches: {
          include: {
            sourceTransaction: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Reconciliation session not found');
    }

    if (session.orgId !== orgId) {
      throw new BadRequestException('Session does not belong to this organization');
    }

    if (session.status === 'finalized') {
      throw new BadRequestException('Session is already finalized');
    }

    // Calculate reconciliation balance
    // Beginning balance + matched transactions = ending balance
    let calculatedBalance = new Decimal(session.statementBeginningBalance);

    for (const match of session.matches) {
      if (match.sourceTransaction) {
        // Add or subtract based on transaction amount
        calculatedBalance = calculatedBalance.plus(match.sourceTransaction.amount);
      }
    }

    // Validate balance matches statement ending balance
    const difference = calculatedBalance.minus(session.statementEndingBalance).abs();
    const tolerance = new Decimal('0.01'); // 1 cent tolerance

    if (difference.greaterThan(tolerance)) {
      throw new BadRequestException(
        `Reconciliation does not balance. Calculated: ${calculatedBalance.toString()}, Statement: ${session.statementEndingBalance.toString()}, Difference: ${difference.toString()}`,
      );
    }

    // Finalize the session
    const finalized = await this.prisma.reconSession.update({
      where: { id: sessionId },
      data: {
        status: 'finalized',
        finalizedAt: new Date(),
        finalizedBy: userId,
      },
      include: {
        matches: {
          include: {
            sourceTransaction: true,
          },
        },
      },
    });

    return finalized;
  }

  async deleteMatch(orgId: string, matchId: string) {
    const match = await this.prisma.reconMatch.findUnique({
      where: { id: matchId },
      include: {
        reconSession: true,
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (match.reconSession.orgId !== orgId) {
      throw new BadRequestException('Match does not belong to this organization');
    }

    if (match.reconSession.status === 'finalized') {
      throw new BadRequestException('Cannot delete matches from a finalized session');
    }

    await this.prisma.reconMatch.delete({
      where: { id: matchId },
    });

    return { success: true, message: 'Match deleted' };
  }

  /**
   * Auto-match transactions in a reconciliation session
   */
  async autoMatchSession(orgId: string, sessionId: string) {
    const session = await this.prisma.reconSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Reconciliation session not found');
    }

    if (session.orgId !== orgId) {
      throw new BadRequestException('Session does not belong to this organization');
    }

    if (session.status === 'finalized') {
      throw new BadRequestException('Cannot auto-match a finalized session');
    }

    const result = await this.autoMatchService.autoMatchReconSession(
      sessionId,
      orgId,
    );

    return {
      success: true,
      matched: result.matched,
      unmatched: result.unmatched,
      message: `Auto-matched ${result.matched} transactions. ${result.unmatched} remain unmatched.`,
    };
  }
}
