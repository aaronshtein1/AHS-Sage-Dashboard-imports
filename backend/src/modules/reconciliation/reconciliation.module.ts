import { Module, forwardRef } from '@nestjs/common';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { PrismaService } from '../../common/prisma.service';
import { BankModule } from '../bank/bank.module';

@Module({
  imports: [forwardRef(() => BankModule)],
  controllers: [ReconciliationController],
  providers: [ReconciliationService, PrismaService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
