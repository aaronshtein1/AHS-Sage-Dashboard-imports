import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JournalService } from './journal.service';
import {
  CreateJournalEntryDto,
  UpdateJournalEntryDto,
  ListJournalsQueryDto,
  PostJournalDto,
  ReverseJournalDto,
} from './dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { CurrentOrg } from '../../decorators/current-org.decorator';
import type { OrgContext } from '../../common/types';

@Controller('journals')
@UseGuards(JwtAuthGuard, TenantGuard)
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  /**
   * Get all journal types for the organization
   */
  @Get('types')
  async getJournalTypes(@CurrentOrg() orgContext: OrgContext) {
    return this.journalService.getJournalTypes(orgContext.orgId);
  }

  /**
   * Create a new journal type
   */
  @Post('types')
  @HttpCode(HttpStatus.CREATED)
  async createJournalType(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: { code: string; name: string; description?: string },
  ) {
    return this.journalService.createJournalType(orgContext.orgId, dto);
  }

  /**
   * Update a journal type
   */
  @Put('types/:typeId')
  async updateJournalType(
    @CurrentOrg() orgContext: OrgContext,
    @Param('typeId') typeId: string,
    @Body() dto: { name?: string; description?: string },
  ) {
    return this.journalService.updateJournalType(orgContext.orgId, typeId, dto);
  }

  /**
   * Delete a journal type
   */
  @Delete('types/:typeId')
  async deleteJournalType(
    @CurrentOrg() orgContext: OrgContext,
    @Param('typeId') typeId: string,
  ) {
    return this.journalService.deleteJournalType(orgContext.orgId, typeId);
  }

  /**
   * List journal entries with pagination and filters
   */
  @Get()
  async listJournals(
    @CurrentOrg() orgContext: OrgContext,
    @Query() query: ListJournalsQueryDto,
  ) {
    return this.journalService.listJournalEntries(orgContext.orgId, query);
  }

  /**
   * Get a single journal entry
   */
  @Get(':id')
  async getJournal(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.journalService.getJournalEntry(orgContext.orgId, id);
  }

  /**
   * Create a new journal entry (draft)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createJournal(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: CreateJournalEntryDto,
  ) {
    return this.journalService.createJournalEntry(
      orgContext.orgId,
      orgContext.userId,
      dto,
    );
  }

  /**
   * Update a draft journal entry
   */
  @Put(':id')
  async updateJournal(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateJournalEntryDto,
  ) {
    return this.journalService.updateJournalEntry(
      orgContext.orgId,
      orgContext.userId,
      id,
      dto,
    );
  }

  /**
   * Delete a draft journal entry
   */
  @Delete(':id')
  async deleteJournal(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.journalService.deleteJournalEntry(orgContext.orgId, id);
  }

  /**
   * Bulk delete all draft journal entries (for import reset)
   */
  @Delete()
  async deleteAllDraftJournals(
    @CurrentOrg() orgContext: OrgContext,
  ) {
    return this.journalService.deleteAllDraftEntries(orgContext.orgId);
  }

  /**
   * Post a journal entry to the ledger
   */
  @Post(':id/post')
  @HttpCode(HttpStatus.OK)
  async postJournal(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
    @Body() dto: PostJournalDto,
  ) {
    return this.journalService.postJournalEntry(
      orgContext.orgId,
      orgContext.userId,
      id,
    );
  }

  /**
   * Reverse a posted journal entry
   */
  @Post(':id/reverse')
  @HttpCode(HttpStatus.OK)
  async reverseJournal(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
    @Body() dto: ReverseJournalDto,
  ) {
    const reversalDate = dto.reversalDate ? new Date(dto.reversalDate) : undefined;
    return this.journalService.reverseJournalEntry(
      orgContext.orgId,
      orgContext.userId,
      id,
      reversalDate,
    );
  }

  /**
   * Unpost a journal entry (revert back to draft without creating reversal)
   */
  @Post(':id/unpost')
  @HttpCode(HttpStatus.OK)
  async unpostJournal(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.journalService.unpostJournalEntry(
      orgContext.orgId,
      orgContext.userId,
      id,
    );
  }
}
