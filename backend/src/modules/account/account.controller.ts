import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountType } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { CurrentOrg } from '../../decorators/current-org.decorator';
import type { OrgContext } from '../../common/types';

@Controller('accounts')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /**
   * List all accounts
   */
  @Get()
  async getAccounts(
    @CurrentOrg() orgContext: OrgContext,
    @Query('includeInactive') includeInactive?: string,
    @Query('accountType') accountType?: AccountType,
    @Query('isBankAccount') isBankAccount?: string,
  ) {
    return this.accountService.getAccounts(orgContext.orgId, {
      includeInactive: includeInactive === 'true',
      accountType,
      isBankAccount: isBankAccount ? isBankAccount === 'true' : undefined,
    });
  }

  /**
   * Get a single account
   */
  @Get(':id')
  async getAccount(@CurrentOrg() orgContext: OrgContext, @Param('id') id: string) {
    return this.accountService.getAccount(orgContext.orgId, id);
  }

  /**
   * Create a new account
   */
  @Post()
  async createAccount(@CurrentOrg() orgContext: OrgContext, @Body() dto: any) {
    return this.accountService.createAccount(orgContext.orgId, orgContext.userId, dto);
  }

  /**
   * Update an account
   */
  @Put(':id')
  async updateAccount(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.accountService.updateAccount(orgContext.orgId, orgContext.userId, id, dto);
  }

  /**
   * Get dimension types
   */
  @Get('dimensions/types')
  async getDimensionTypes(@CurrentOrg() orgContext: OrgContext) {
    return this.accountService.getDimensionTypes(orgContext.orgId);
  }

  /**
   * Get all dimension values
   */
  @Get('dimensions/values')
  async getAllDimensionValues(@CurrentOrg() orgContext: OrgContext) {
    return this.accountService.getAllDimensionValues(orgContext.orgId);
  }

  /**
   * Get dimension values for a type
   */
  @Get('dimensions/types/:typeId/values')
  async getDimensionValues(
    @CurrentOrg() orgContext: OrgContext,
    @Param('typeId') typeId: string,
  ) {
    return this.accountService.getDimensionValues(orgContext.orgId, typeId);
  }
}
