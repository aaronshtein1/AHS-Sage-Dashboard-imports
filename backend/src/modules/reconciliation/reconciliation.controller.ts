import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { CreateReconSessionDto, CreateMatchDto } from './dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentOrg } from '../../decorators/current-org.decorator';
import type { OrgContext } from '../../common/types';

@Controller('reconciliation')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get('sessions')
  async listSessions(
    @CurrentOrg() orgContext: OrgContext,
    @Query('accountId') accountId?: string,
  ) {
    return this.reconciliationService.listSessions(orgContext.orgId, accountId);
  }

  @Post('sessions')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async createSession(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: CreateReconSessionDto,
  ) {
    return this.reconciliationService.createSession(
      orgContext.orgId,
      orgContext.userId,
      dto,
    );
  }

  @Get('sessions/:id')
  async getSession(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') sessionId: string,
  ) {
    return this.reconciliationService.getSession(orgContext.orgId, sessionId);
  }

  @Post('sessions/:id/match')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async createMatch(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') sessionId: string,
    @Body() dto: CreateMatchDto,
  ) {
    return this.reconciliationService.createMatch(
      orgContext.orgId,
      sessionId,
      dto,
    );
  }

  @Post('sessions/:id/finalize')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async finalizeSession(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') sessionId: string,
  ) {
    return this.reconciliationService.finalizeSession(
      orgContext.orgId,
      orgContext.userId,
      sessionId,
    );
  }

  @Delete('matches/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async deleteMatch(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') matchId: string,
  ) {
    return this.reconciliationService.deleteMatch(orgContext.orgId, matchId);
  }

  @Post('sessions/:id/auto-match')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async autoMatch(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') sessionId: string,
  ) {
    return this.reconciliationService.autoMatchSession(
      orgContext.orgId,
      sessionId,
    );
  }

  @Get('sessions/:id/summary')
  async getReconciliationSummary(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') sessionId: string,
  ) {
    const session = await this.reconciliationService.getSession(
      orgContext.orgId,
      sessionId,
    );
    return session.summary;
  }
}
