import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { IsOptional, IsString, IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ReportsService } from './reports.service';
import type { ReportDefinition } from './reports.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { CurrentOrg } from '../../decorators/current-org.decorator';
import type { OrgContext } from '../../common/types';

class TrialBalanceQueryDto {
  @IsOptional()
  @IsString()
  asOfDate?: string;
}

class BalanceSheetQueryDto {
  @IsOptional()
  @IsString()
  asOfDate?: string;
}

class ProfitLossQueryDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

class JournalListingQueryDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  journalTypeId?: string;
}

class AccountBalancesQueryDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeMonthly?: boolean;
}

class ReportFiltersDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  asOfDate?: string;

  @IsOptional()
  @IsArray()
  accountTypes?: string[];

  @IsOptional()
  @IsArray()
  accountIds?: string[];

  @IsOptional()
  @IsString()
  accountCodeStart?: string;

  @IsOptional()
  @IsString()
  accountCodeEnd?: string;

  @IsOptional()
  @IsArray()
  departmentIds?: string[];

  @IsOptional()
  @IsArray()
  locationIds?: string[];

  @IsOptional()
  @IsBoolean()
  includeZeroBalances?: boolean;

  @IsOptional()
  @IsBoolean()
  includeInactiveAccounts?: boolean;
}

class GenerateReportDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  reportType!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReportFiltersDto)
  filters?: ReportFiltersDto;

  @IsOptional()
  @IsString()
  comparison?: string;

  @IsOptional()
  @IsString()
  groupBy?: string;

  @IsOptional()
  @IsBoolean()
  showSubtotals?: boolean;

  @IsOptional()
  @IsBoolean()
  showGrandTotal?: boolean;
}

@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Get available report definitions
   */
  @Get('definitions')
  async getReportDefinitions(@CurrentOrg() orgContext: OrgContext) {
    return this.reportsService.getSavedReports(orgContext.orgId);
  }

  /**
   * Generate a report from a definition
   */
  @Post('generate')
  async generateReport(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: GenerateReportDto,
  ) {
    const definition: ReportDefinition = {
      id: dto.id,
      name: dto.name,
      description: dto.description,
      reportType: dto.reportType as ReportDefinition['reportType'],
      filters: dto.filters || {},
      comparison: dto.comparison as ReportDefinition['comparison'],
      groupBy: dto.groupBy as ReportDefinition['groupBy'],
      showSubtotals: dto.showSubtotals,
      showGrandTotal: dto.showGrandTotal,
    };
    return this.reportsService.generateReport(orgContext.orgId, definition);
  }

  /**
   * Get Trial Balance report
   */
  @Get('trial-balance')
  async getTrialBalance(
    @CurrentOrg() orgContext: OrgContext,
    @Query() query: TrialBalanceQueryDto,
  ) {
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();
    return this.reportsService.getTrialBalance(orgContext.orgId, asOfDate);
  }

  /**
   * Get Balance Sheet report
   */
  @Get('balance-sheet')
  async getBalanceSheet(
    @CurrentOrg() orgContext: OrgContext,
    @Query() query: BalanceSheetQueryDto,
  ) {
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();
    return this.reportsService.getBalanceSheet(orgContext.orgId, asOfDate);
  }

  /**
   * Get Profit & Loss report
   */
  @Get('profit-loss')
  async getProfitLoss(
    @CurrentOrg() orgContext: OrgContext,
    @Query() query: ProfitLossQueryDto,
  ) {
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(new Date().getFullYear(), 0, 1);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    return this.reportsService.getProfitLoss(
      orgContext.orgId,
      startDate,
      endDate,
    );
  }

  /**
   * Get Journal Listing report
   */
  @Get('journal-listing')
  async getJournalListing(
    @CurrentOrg() orgContext: OrgContext,
    @Query() query: JournalListingQueryDto,
  ) {
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(new Date().getFullYear(), 0, 1);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    return this.reportsService.getJournalListing(
      orgContext.orgId,
      startDate,
      endDate,
      query.journalTypeId,
    );
  }

  /**
   * Get account balances from ledger postings
   * Used by the Financial Report Writer for preview generation
   */
  @Get('account-balances')
  async getAccountBalances(
    @CurrentOrg() orgContext: OrgContext,
    @Query() query: AccountBalancesQueryDto,
  ) {
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(new Date().getFullYear(), 0, 1);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    return this.reportsService.getAccountBalances(orgContext.orgId, startDate, endDate, {
      includeMonthly: query.includeMonthly,
    });
  }
}
