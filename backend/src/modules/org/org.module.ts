import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  imports: [ConfigModule.forRoot(), JwtModule.register({})],
  controllers: [OrgController],
  providers: [OrgService, PrismaService],
  exports: [OrgService],
})
export class OrgModule {}
