import { Module } from '@nestjs/common';
import { ApController } from './ap.controller';
import { ApService } from './ap.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [ApController],
  providers: [ApService, PrismaService],
  exports: [ApService],
})
export class ApModule {}
