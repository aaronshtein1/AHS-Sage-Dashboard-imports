import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { OrgModule } from './modules/org/org.module';
import { UserModule } from './modules/user/user.module';
import { PostingModule } from './modules/posting/posting.module';
import { JournalModule } from './modules/journal/journal.module';
import { AccountModule } from './modules/account/account.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PlaidModule } from './modules/plaid/plaid.module';
import { BankModule } from './modules/bank/bank.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { ApModule } from './modules/ap/ap.module';
import { ArModule } from './modules/ar/ar.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    OrgModule,
    UserModule,
    PostingModule,
    JournalModule,
    AccountModule,
    ReportsModule,
    PlaidModule,
    BankModule,
    ReconciliationModule,
    ApModule,
    ArModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
