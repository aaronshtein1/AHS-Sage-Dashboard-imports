import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PlaidService } from './plaid.service';
import { ExchangeTokenDto, SyncTransactionsDto } from './dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { CurrentOrg } from '../../decorators/current-org.decorator';
import type { OrgContext } from '../../common/types';

@Controller('plaid')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PlaidController {
  constructor(private readonly plaidService: PlaidService) {}

  @Post('link-token')
  async createLinkToken(@CurrentOrg() orgContext: OrgContext) {
    return this.plaidService.createLinkToken(orgContext.userId, orgContext.orgId);
  }

  @Post('exchange-token')
  async exchangeToken(
    @Body() dto: ExchangeTokenDto,
    @CurrentOrg() orgContext: OrgContext,
  ) {
    return this.plaidService.exchangePublicToken(dto, orgContext.orgId);
  }

  @Get('accounts')
  async getAccounts(@CurrentOrg() orgContext: OrgContext) {
    return this.plaidService.getAccounts(orgContext.orgId);
  }

  @Post('sync')
  async syncTransactions(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto?: SyncTransactionsDto,
  ) {
    return this.plaidService.syncTransactions(orgContext.orgId, dto);
  }

  @Delete('accounts/:id')
  async disconnectAccount(
    @Param('id') plaidItemId: string,
    @CurrentOrg() orgContext: OrgContext,
  ) {
    return this.plaidService.disconnectAccount(plaidItemId, orgContext.orgId);
  }
}
