import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationService } from './reconciliation.service';
import { PrismaService } from '../../common/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let prisma: PrismaService;

  const mockPrismaService = {
    account: {
      findUnique: jest.fn(),
    },
    reconSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    reconMatch: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    sourceTransaction: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should create a session with beginning balance from prior session', async () => {
      const orgId = 'test-org-id';
      const userId = 'test-user-id';
      const accountId = 'test-account-id';

      const mockAccount = {
        id: accountId,
        orgId,
        accountCode: '1010',
        accountTitle: 'Cash',
      };

      const mockPriorSession = {
        id: 'prior-session-id',
        orgId,
        accountId,
        statementEndingBalance: new Decimal(1000),
        statementEndDate: new Date('2024-01-31'),
        status: 'finalized',
      };

      const mockNewSession = {
        id: 'new-session-id',
        orgId,
        accountId,
        statementBeginningBalance: new Decimal(1000),
        statementEndingBalance: new Decimal(1500),
        statementEndDate: new Date('2024-02-28'),
        status: 'draft',
        matches: [],
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.reconSession.findFirst.mockResolvedValue(mockPriorSession);
      mockPrismaService.reconSession.create.mockResolvedValue(mockNewSession);

      const result = await service.createSession(orgId, userId, {
        accountId,
        statementEndingBalance: '1500',
        statementEndDate: '2024-02-28',
      });

      expect(result.statementBeginningBalance).toEqual(new Decimal(1000));
      expect(mockPrismaService.reconSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            statementBeginningBalance: new Decimal(1000),
          }),
        }),
      );
    });

    it('should default beginning balance to 0 if no prior session exists', async () => {
      const orgId = 'test-org-id';
      const userId = 'test-user-id';
      const accountId = 'test-account-id';

      const mockAccount = {
        id: accountId,
        orgId,
        accountCode: '1010',
        accountTitle: 'Cash',
      };

      const mockNewSession = {
        id: 'new-session-id',
        orgId,
        accountId,
        statementBeginningBalance: new Decimal(0),
        statementEndingBalance: new Decimal(500),
        statementEndDate: new Date('2024-01-31'),
        status: 'draft',
        matches: [],
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.reconSession.findFirst.mockResolvedValue(null);
      mockPrismaService.reconSession.create.mockResolvedValue(mockNewSession);

      const result = await service.createSession(orgId, userId, {
        accountId,
        statementEndingBalance: '500',
        statementEndDate: '2024-01-31',
      });

      expect(result.statementBeginningBalance).toEqual(new Decimal(0));
    });
  });

  describe('finalizeSession', () => {
    it('should finalize session when balance matches within tolerance', async () => {
      const orgId = 'test-org-id';
      const userId = 'test-user-id';
      const sessionId = 'test-session-id';

      const mockSession = {
        id: sessionId,
        orgId,
        accountId: 'test-account-id',
        statementBeginningBalance: new Decimal(1000),
        statementEndingBalance: new Decimal(1100),
        statementEndDate: new Date('2024-01-31'),
        status: 'draft',
        matches: [
          {
            id: 'match-1',
            sourceTransaction: {
              id: 'txn-1',
              amount: new Decimal(100),
            },
          },
        ],
      };

      const mockFinalizedSession = {
        ...mockSession,
        status: 'finalized',
        finalizedAt: new Date(),
        finalizedBy: userId,
      };

      mockPrismaService.reconSession.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.reconSession.update.mockResolvedValue(mockFinalizedSession);

      const result = await service.finalizeSession(orgId, userId, sessionId);

      expect(result.status).toBe('finalized');
      expect(mockPrismaService.reconSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sessionId },
          data: expect.objectContaining({
            status: 'finalized',
            finalizedBy: userId,
          }),
        }),
      );
    });

    it('should reject finalization when balance does not match', async () => {
      const orgId = 'test-org-id';
      const userId = 'test-user-id';
      const sessionId = 'test-session-id';

      const mockSession = {
        id: sessionId,
        orgId,
        accountId: 'test-account-id',
        statementBeginningBalance: new Decimal(1000),
        statementEndingBalance: new Decimal(1500), // Expected 1500
        statementEndDate: new Date('2024-01-31'),
        status: 'draft',
        matches: [
          {
            id: 'match-1',
            sourceTransaction: {
              id: 'txn-1',
              amount: new Decimal(100), // Only 100, results in 1100 total
            },
          },
        ],
      };

      mockPrismaService.reconSession.findUnique.mockResolvedValue(mockSession);

      await expect(
        service.finalizeSession(orgId, userId, sessionId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.finalizeSession(orgId, userId, sessionId),
      ).rejects.toThrow(/does not balance/);
    });

    it('should allow finalization within 1 cent tolerance', async () => {
      const orgId = 'test-org-id';
      const userId = 'test-user-id';
      const sessionId = 'test-session-id';

      const mockSession = {
        id: sessionId,
        orgId,
        accountId: 'test-account-id',
        statementBeginningBalance: new Decimal(1000),
        statementEndingBalance: new Decimal('1100.01'), // Off by 1 cent
        statementEndDate: new Date('2024-01-31'),
        status: 'draft',
        matches: [
          {
            id: 'match-1',
            sourceTransaction: {
              id: 'txn-1',
              amount: new Decimal(100),
            },
          },
        ],
      };

      const mockFinalizedSession = {
        ...mockSession,
        status: 'finalized',
        finalizedAt: new Date(),
        finalizedBy: userId,
      };

      mockPrismaService.reconSession.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.reconSession.update.mockResolvedValue(mockFinalizedSession);

      const result = await service.finalizeSession(orgId, userId, sessionId);

      expect(result.status).toBe('finalized');
    });

    it('should prevent finalization of already finalized session', async () => {
      const orgId = 'test-org-id';
      const userId = 'test-user-id';
      const sessionId = 'test-session-id';

      const mockSession = {
        id: sessionId,
        orgId,
        status: 'finalized',
        matches: [],
      };

      mockPrismaService.reconSession.findUnique.mockResolvedValue(mockSession);

      await expect(
        service.finalizeSession(orgId, userId, sessionId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.finalizeSession(orgId, userId, sessionId),
      ).rejects.toThrow(/already finalized/);
    });
  });

  describe('createMatch', () => {
    it('should prevent creating matches on finalized session', async () => {
      const orgId = 'test-org-id';
      const sessionId = 'test-session-id';

      const mockSession = {
        id: sessionId,
        orgId,
        status: 'finalized',
      };

      mockPrismaService.reconSession.findUnique.mockResolvedValue(mockSession);

      await expect(
        service.createMatch(orgId, sessionId, {
          matchType: 'source_to_journal' as any,
          sourceTransactionIds: ['txn-1'],
          journalLineIds: ['line-1'],
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createMatch(orgId, sessionId, {
          matchType: 'source_to_journal' as any,
          sourceTransactionIds: ['txn-1'],
          journalLineIds: ['line-1'],
        }),
      ).rejects.toThrow(/finalized/);
    });
  });

  describe('deleteMatch', () => {
    it('should prevent deleting matches from finalized session', async () => {
      const orgId = 'test-org-id';
      const matchId = 'test-match-id';

      const mockMatch = {
        id: matchId,
        reconSession: {
          id: 'session-id',
          orgId,
          status: 'finalized',
        },
      };

      mockPrismaService.reconMatch.findUnique.mockResolvedValue(mockMatch);

      await expect(service.deleteMatch(orgId, matchId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deleteMatch(orgId, matchId)).rejects.toThrow(
        /finalized/,
      );
    });
  });
});
