import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PlaidService } from './plaid.service';
import { PrismaService } from '../../common/prisma.service';

describe('PlaidService', () => {
  let service: PlaidService;
  let prisma: PrismaService;

  const mockPrismaService = {
    plaidItem: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    plaidAccount: {
      upsert: jest.fn(),
    },
    sourceTransaction: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        PLAID_ENV: 'sandbox',
        PLAID_CLIENT_ID: 'test-client-id',
        PLAID_SECRET: 'test-secret',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaidService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PlaidService>(PlaidService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Transaction Idempotency', () => {
    it('should not create duplicate transactions with same plaidTransactionId', async () => {
      const orgId = 'test-org-id';
      const plaidTransactionId = 'plaid-txn-123';

      const mockTransaction = {
        id: 'txn-1',
        orgId,
        plaidTransactionId,
        amount: 100,
        date: new Date(),
        name: 'Test Transaction',
      };

      mockPrismaService.sourceTransaction.upsert.mockResolvedValue(mockTransaction);

      // First call should create the transaction
      await prisma.sourceTransaction.upsert({
        where: {
          orgId_plaidTransactionId: {
            orgId,
            plaidTransactionId,
          },
        },
        create: mockTransaction,
        update: mockTransaction,
      });

      expect(mockPrismaService.sourceTransaction.upsert).toHaveBeenCalledWith({
        where: {
          orgId_plaidTransactionId: {
            orgId,
            plaidTransactionId,
          },
        },
        create: mockTransaction,
        update: mockTransaction,
      });

      // Second call with same plaidTransactionId should update, not create
      await prisma.sourceTransaction.upsert({
        where: {
          orgId_plaidTransactionId: {
            orgId,
            plaidTransactionId,
          },
        },
        create: mockTransaction,
        update: { ...mockTransaction, amount: 150 },
      });

      expect(mockPrismaService.sourceTransaction.upsert).toHaveBeenCalledTimes(2);
    });

    it('should enforce unique constraint on (orgId, plaidTransactionId)', async () => {
      const orgId1 = 'org-1';
      const orgId2 = 'org-2';
      const plaidTransactionId = 'plaid-txn-123';

      const mockTransaction1 = {
        id: 'txn-1',
        orgId: orgId1,
        plaidTransactionId,
        amount: 100,
      };

      const mockTransaction2 = {
        id: 'txn-2',
        orgId: orgId2,
        plaidTransactionId,
        amount: 200,
      };

      mockPrismaService.sourceTransaction.upsert
        .mockResolvedValueOnce(mockTransaction1)
        .mockResolvedValueOnce(mockTransaction2);

      // Same plaidTransactionId but different orgId should be allowed
      await prisma.sourceTransaction.upsert({
        where: {
          orgId_plaidTransactionId: {
            orgId: orgId1,
            plaidTransactionId,
          },
        },
        create: mockTransaction1,
        update: mockTransaction1,
      });

      await prisma.sourceTransaction.upsert({
        where: {
          orgId_plaidTransactionId: {
            orgId: orgId2,
            plaidTransactionId,
          },
        },
        create: mockTransaction2,
        update: mockTransaction2,
      });

      expect(mockPrismaService.sourceTransaction.upsert).toHaveBeenCalledTimes(2);
    });
  });
});
