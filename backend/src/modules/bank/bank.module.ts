import { Module } from '@nestjs/common';
import { BankController } from './bank.controller';
import { BankService } from './bank.service';
import { PrismaService } from '../../common/prisma.service';
import { JournalModule } from '../journal/journal.module';
import { MatchingService } from './services/matching.service';
import { AutoPostService } from './services/auto-post.service';
import { ReconAutoMatchService } from './services/recon-auto-match.service';
import { RuleSuggestionService } from './services/rule-suggestion.service';

@Module({
  imports: [JournalModule],
  controllers: [BankController],
  providers: [
    BankService,
    PrismaService,
    MatchingService,
    AutoPostService,
    ReconAutoMatchService,
    RuleSuggestionService,
  ],
  exports: [
    BankService,
    MatchingService,
    AutoPostService,
    ReconAutoMatchService,
    RuleSuggestionService,
  ],
})
export class BankModule {}
