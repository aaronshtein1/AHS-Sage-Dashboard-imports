import { Module } from '@nestjs/common';
import { ArController } from './ar.controller';
import { ArService } from './ar.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [ArController],
  providers: [ArService, PrismaService],
  exports: [ArService],
})
export class ArModule {}
