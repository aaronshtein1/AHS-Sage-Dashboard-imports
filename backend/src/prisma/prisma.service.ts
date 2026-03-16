import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Helper to clean database for testing
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase can only be used in test environment');
    }

    // Delete in order respecting foreign keys
    await this.reconMatch.deleteMany();
    await this.reconSession.deleteMany();
    await this.sourceToJournalLine.deleteMany();
    await this.sourceTransaction.deleteMany();
    await this.plaidAccount.deleteMany();
    await this.plaidItem.deleteMany();
    await this.auditEvent.deleteMany();
    await this.ledgerPosting.deleteMany();
    await this.journalLineDimension.deleteMany();
    await this.journalLine.deleteMany();
    await this.journalEntry.deleteMany();
    await this.journalBatch.deleteMany();
    await this.journalType.deleteMany();
    await this.period.deleteMany();
    await this.accountRequiredDimension.deleteMany();
    await this.dimensionValue.deleteMany();
    await this.dimensionType.deleteMany();
    await this.account.deleteMany();
    await this.userRole.deleteMany();
    await this.user.deleteMany();
    await this.org.deleteMany();
  }
}
