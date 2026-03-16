import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import * as bcrypt from 'bcryptjs';

describe('Bank Feed Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    // Create test user and org
    const passwordHash = await bcrypt.hash('password', 10);
    const user = await prisma.user.create({
      data: {
        email: 'bank-test@example.com',
        passwordHash,
        name: 'Test User',
      },
    });

    userId = user.id;

    const org = await prisma.org.create({
      data: { name: 'Test Org', slug: 'test-org' },
    });

    orgId = org.id;

    await prisma.userRole.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role: 'admin',
      },
    });

    // Login to get token
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'bank-test@example.com', password: 'password' })
      .expect(201);

    authToken = response.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.reconMatch.deleteMany({ where: { reconSession: { orgId } } });
    await prisma.reconSession.deleteMany({ where: { orgId } });
    await prisma.transactionMatch.deleteMany({ where: { sourceTransaction: { orgId } } });
    await prisma.sourceToJournalLine.deleteMany({
      where: { sourceTransaction: { orgId } },
    });
    await prisma.ledgerPosting.deleteMany({ where: { orgId } });
    await prisma.journalLine.deleteMany({ where: { journalEntry: { orgId } } });
    await prisma.journalEntry.deleteMany({ where: { orgId } });
    await prisma.sourceTransaction.deleteMany({ where: { orgId } });
    await prisma.bankFeedRule.deleteMany({ where: { orgId } });
    await prisma.bankAccountMapping.deleteMany({ where: { orgId } });
    await prisma.journalType.deleteMany({ where: { orgId } });
    await prisma.account.deleteMany({ where: { orgId } });
    await prisma.userRole.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.org.delete({ where: { id: orgId } });

    await prisma.$disconnect();
    await app.close();
  });

  describe('Bank Feed Matching', () => {
    let cashAccount: any;
    let expenseAccount: any;
    let sourceTransaction: any;

    beforeEach(async () => {
      // Clean up previous test data
      await prisma.transactionMatch.deleteMany({
        where: { sourceTransaction: { orgId } },
      });
      await prisma.sourceTransaction.deleteMany({ where: { orgId } });
      await prisma.bankFeedRule.deleteMany({ where: { orgId } });
      await prisma.account.deleteMany({ where: { orgId } });

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
        .post('/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Office Supplies Rule',
          matchType: 'CONTAINS_TEXT',
          descriptionPattern: 'Office Depot',
          assignToAccountId: expenseAccount.id,
          priority: 10,
          isActive: true,
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Office Supplies Rule');
      expect(response.body.orgId).toBe(orgId);
    });

    it('should match transaction using CONTAINS_TEXT rule', async () => {
      // Create rule
      const rule = await request(app.getHttpServer())
        .post('/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Office Rule',
          matchType: 'CONTAINS_TEXT',
          descriptionPattern: 'Office',
          assignToAccountId: expenseAccount.id,
          priority: 10,
          isActive: true,
        })
        .expect(201);

      // Match transaction
      await request(app.getHttpServer())
        .post(`/bank/transactions/${sourceTransaction.id}/match`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Verify matched
      const matched = await prisma.sourceTransaction.findUnique({
        where: { id: sourceTransaction.id },
      });

      expect(matched.status).toBe('MATCHED');
      expect(matched.accountId).toBe(expenseAccount.id);
      expect(matched.matchedRuleId).toBe(rule.body.id);
      expect(matched.matchConfidence).toBe('MEDIUM'); // CONTAINS_TEXT gives MEDIUM confidence
    });

    it('should match transaction using EXACT_MERCHANT rule with HIGH confidence', async () => {
      // Create exact match rule
      const rule = await request(app.getHttpServer())
        .post('/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Exact Office Depot',
          matchType: 'EXACT_MERCHANT',
          merchantPattern: 'Office Depot',
          assignToAccountId: expenseAccount.id,
          priority: 100,
          isActive: true,
        })
        .expect(201);

      // Match transaction
      await request(app.getHttpServer())
        .post(`/bank/transactions/${sourceTransaction.id}/match`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Verify matched with HIGH confidence
      const matched = await prisma.sourceTransaction.findUnique({
        where: { id: sourceTransaction.id },
      });

      expect(matched.status).toBe('MATCHED');
      expect(matched.matchConfidence).toBe('HIGH');
      expect(matched.matchedRuleId).toBe(rule.body.id);
    });

    it('should auto-post high-confidence matched transaction', async () => {
      // Create journal type first
      const journalType = await prisma.journalType.create({
        data: {
          orgId,
          code: 'GJ',
          name: 'General Journal',
          book: 'Accrual',
        },
      });

      // Create bank mapping
      await prisma.bankAccountMapping.create({
        data: {
          orgId,
          plaidAccountId: 'test-plaid-account',
          glAccountId: cashAccount.id,
          enableAutoPosting: true,
        },
      });

      // Create auto-post rule with HIGH confidence
      await request(app.getHttpServer())
        .post('/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Auto-Post Office',
          matchType: 'EXACT_MERCHANT',
          merchantPattern: 'Office Depot',
          assignToAccountId: expenseAccount.id,
          autoPost: true,
          priority: 100,
          isActive: true,
        })
        .expect(201);

      // Match transaction
      await request(app.getHttpServer())
        .post(`/bank/transactions/${sourceTransaction.id}/match`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Verify posted
      const posted = await prisma.sourceTransaction.findUnique({
        where: { id: sourceTransaction.id },
        include: { journalEntry: { include: { lines: true } } },
      });

      expect(posted.status).toBe('POSTED');
      expect(posted.journalEntry).toBeDefined();
      expect(posted.journalEntry.status).toBe('POSTED');
      expect(posted.journalEntry.lines.length).toBe(2);

      // Verify debits and credits balance
      const totalDebit = posted.journalEntry.lines.reduce(
        (sum, line) => sum + parseFloat(line.debitAmount?.toString() || '0'),
        0,
      );
      const totalCredit = posted.journalEntry.lines.reduce(
        (sum, line) => sum + parseFloat(line.creditAmount?.toString() || '0'),
        0,
      );
      expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
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
        .post('/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Office Rule',
          matchType: 'CONTAINS_TEXT',
          descriptionPattern: 'Office',
          assignToAccountId: expenseAccount.id,
          priority: 10,
          isActive: true,
        })
        .expect(201);

      // Batch match
      const response = await request(app.getHttpServer())
        .post('/bank/transactions/match-batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionIds: [sourceTransaction.id, tx2.id],
        })
        .expect(201);

      expect(response.body.length).toBe(2);
      expect(response.body.every((r) => r.success)).toBe(true);

      // Verify both are matched
      const matched1 = await prisma.sourceTransaction.findUnique({
        where: { id: sourceTransaction.id },
      });
      const matched2 = await prisma.sourceTransaction.findUnique({
        where: { id: tx2.id },
      });

      expect(matched1.status).toBe('MATCHED');
      expect(matched2.status).toBe('MATCHED');
    });

    it('should respect rule priority when matching', async () => {
      // Create low priority rule
      const lowPriorityRule = await request(app.getHttpServer())
        .post('/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Low Priority',
          matchType: 'CONTAINS_TEXT',
          descriptionPattern: 'Office',
          assignToAccountId: cashAccount.id, // Different account
          priority: 5,
          isActive: true,
        })
        .expect(201);

      // Create high priority rule
      const highPriorityRule = await request(app.getHttpServer())
        .post('/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'High Priority',
          matchType: 'EXACT_MERCHANT',
          merchantPattern: 'Office Depot',
          assignToAccountId: expenseAccount.id,
          priority: 100,
          isActive: true,
        })
        .expect(201);

      // Match transaction
      await request(app.getHttpServer())
        .post(`/bank/transactions/${sourceTransaction.id}/match`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Should match high priority rule with HIGH confidence
      const matched = await prisma.sourceTransaction.findUnique({
        where: { id: sourceTransaction.id },
      });

      expect(matched.matchedRuleId).toBe(highPriorityRule.body.id);
      expect(matched.accountId).toBe(expenseAccount.id);
      expect(matched.matchConfidence).toBe('HIGH');
    });

    it('should not match inactive rules', async () => {
      // Create inactive rule
      await request(app.getHttpServer())
        .post('/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Inactive Rule',
          matchType: 'EXACT_MERCHANT',
          merchantPattern: 'Office Depot',
          assignToAccountId: expenseAccount.id,
          priority: 100,
          isActive: false, // Inactive
        })
        .expect(201);

      // Match transaction
      await request(app.getHttpServer())
        .post(`/bank/transactions/${sourceTransaction.id}/match`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Should not be matched
      const notMatched = await prisma.sourceTransaction.findUnique({
        where: { id: sourceTransaction.id },
      });

      expect(notMatched.status).toBe('PENDING');
      expect(notMatched.matchedRuleId).toBeNull();
    });

    it('should enforce multi-tenant isolation for rules', async () => {
      // Create another org
      const org2 = await prisma.org.create({
        data: { name: 'Other Org', slug: 'other-org' },
      });

      // Create transaction in org2
      const tx2 = await prisma.sourceTransaction.create({
        data: {
          orgId: org2.id,
          plaidTransactionId: 'other-tx-' + Date.now(),
          plaidAccountId: 'other-plaid-account',
          amount: -100.0,
          date: new Date(),
          name: 'Office Depot',
          status: 'PENDING',
          rawJson: {},
          category: [],
        },
      });

      // Create rule in org1 (current org)
      await request(app.getHttpServer())
        .post('/bank/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Org1 Rule',
          matchType: 'CONTAINS_TEXT',
          descriptionPattern: 'Office',
          assignToAccountId: expenseAccount.id,
          priority: 10,
          isActive: true,
        })
        .expect(201);

      // Try to match org2 transaction (should fail or not match)
      await request(app.getHttpServer())
        .post(`/bank/transactions/${tx2.id}/match`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404); // Should not find transaction in different org

      // Cleanup
      await prisma.sourceTransaction.delete({ where: { id: tx2.id } });
      await prisma.org.delete({ where: { id: org2.id } });
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

      // Create journal type
      const journalType = await prisma.journalType.create({
        data: {
          orgId,
          code: 'GJ',
          name: 'General Journal',
          book: 'Accrual',
        },
      });

      // Create journal entry
      const journalEntry = await prisma.journalEntry.create({
        data: {
          orgId,
          journalTypeId: journalType.id,
          entryDate: new Date(),
          description: 'Electric Company Payment',
          status: 'POSTED',
          postingDate: new Date(),
          postedAt: new Date(),
          createdById: userId,
          postedById: userId,
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
        include: { lines: true },
      });

      // Create bank mapping
      await prisma.bankAccountMapping.create({
        data: {
          orgId,
          plaidAccountId: 'recon-plaid-acct',
          glAccountId: cashAccount.id,
          enableAutoPosting: false,
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
        .post(`/bank/reconciliation/${reconSession.id}/auto-match`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.matched).toBeGreaterThan(0);
      expect(response.body.unmatched).toBeDefined();

      // Verify match created
      const matches = await prisma.reconMatch.findMany({
        where: { reconSessionId: reconSession.id },
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].sourceTransactionId).toBe(sourceTx.id);
      expect(matches[0].matchType).toBe('source_to_journal');
    });

    it('should match transactions within date tolerance', async () => {
      // Setup accounts
      const cashAccount = await prisma.account.create({
        data: {
          orgId,
          accountCode: '1002',
          title: 'Checking 2',
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
          closingType: 'NON_CLOSING',
        },
      });

      const expAccount = await prisma.account.create({
        data: {
          orgId,
          accountCode: '5002',
          title: 'Rent',
          accountType: 'EXPENSE',
          normalBalance: 'DEBIT',
          closingType: 'CLOSING',
        },
      });

      // Create source transaction on Day 1
      const txDate = new Date('2025-02-01');
      const sourceTx = await prisma.sourceTransaction.create({
        data: {
          orgId,
          plaidTransactionId: 'recon-tx-date-' + Date.now(),
          plaidAccountId: 'recon-plaid-acct-2',
          amount: -1500.0,
          date: txDate,
          name: 'Rent Payment',
          status: 'POSTED',
          rawJson: {},
          category: [],
        },
      });

      // Create journal entry on Day 3 (within 3-day tolerance)
      const journalDate = new Date('2025-02-03');
      const journalType = await prisma.journalType.create({
        data: {
          orgId,
          code: 'GJ2',
          name: 'General Journal 2',
          book: 'Accrual',
        },
      });

      await prisma.journalEntry.create({
        data: {
          orgId,
          journalTypeId: journalType.id,
          entryDate: journalDate,
          description: 'Rent Payment',
          status: 'POSTED',
          postingDate: journalDate,
          postedAt: new Date(),
          createdById: userId,
          postedById: userId,
          lines: {
            create: [
              {
                lineNumber: 1,
                accountId: cashAccount.id,
                creditAmount: 1500.0,
                memo: 'Rent',
              },
              {
                lineNumber: 2,
                accountId: expAccount.id,
                debitAmount: 1500.0,
                memo: 'Rent',
              },
            ],
          },
        },
      });

      // Create bank mapping
      await prisma.bankAccountMapping.create({
        data: {
          orgId,
          plaidAccountId: 'recon-plaid-acct-2',
          glAccountId: cashAccount.id,
          enableAutoPosting: false,
        },
      });

      // Create recon session
      const reconSession = await prisma.reconSession.create({
        data: {
          orgId,
          accountId: cashAccount.id,
          statementBeginningBalance: 5000.0,
          statementEndingBalance: 3500.0,
          statementEndDate: new Date('2025-02-10'),
          status: 'draft',
        },
      });

      // Trigger auto-match
      const response = await request(app.getHttpServer())
        .post(`/bank/reconciliation/${reconSession.id}/auto-match`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Should match despite 2-day difference
      expect(response.body.matched).toBe(1);
    });
  });

  describe('Manual Transaction Posting', () => {
    it('should manually post a categorized transaction', async () => {
      // Setup
      const cashAccount = await prisma.account.create({
        data: {
          orgId,
          accountCode: '1003',
          title: 'Cash 3',
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
          closingType: 'NON_CLOSING',
        },
      });

      const expAccount = await prisma.account.create({
        data: {
          orgId,
          accountCode: '5003',
          title: 'Travel',
          accountType: 'EXPENSE',
          normalBalance: 'DEBIT',
          closingType: 'CLOSING',
        },
      });

      // Create journal type
      await prisma.journalType.create({
        data: {
          orgId,
          code: 'GJ3',
          name: 'General Journal 3',
          book: 'Accrual',
        },
      });

      // Create bank mapping
      await prisma.bankAccountMapping.create({
        data: {
          orgId,
          plaidAccountId: 'manual-plaid-acct',
          glAccountId: cashAccount.id,
          enableAutoPosting: false,
        },
      });

      // Create categorized transaction
      const tx = await prisma.sourceTransaction.create({
        data: {
          orgId,
          plaidTransactionId: 'manual-tx-' + Date.now(),
          plaidAccountId: 'manual-plaid-acct',
          amount: -250.0,
          date: new Date(),
          name: 'Uber',
          status: 'CATEGORIZED',
          accountId: expAccount.id,
          memo: 'Business travel',
          rawJson: {},
          category: [],
        },
      });

      // Manually post
      const response = await request(app.getHttpServer())
        .post(`/bank/transactions/${tx.id}/post`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.journalId).toBeDefined();

      // Verify journal entry created
      const posted = await prisma.sourceTransaction.findUnique({
        where: { id: tx.id },
        include: { journalEntry: { include: { lines: true } } },
      });

      expect(posted.status).toBe('POSTED');
      expect(posted.journalEntry.lines.length).toBe(2);
    });
  });

  describe('API Endpoint Security', () => {
    it('should reject requests without auth token', async () => {
      await request(app.getHttpServer())
        .get('/bank/rules')
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/bank/rules')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
