import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { PostingService } from '../posting/posting.service';
import { Prisma, AuditAction } from '@prisma/client';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;
import {
  CreateJournalEntryDto,
  UpdateJournalEntryDto,
  ListJournalsQueryDto,
  JournalStatusFilter,
} from './dto';
import { PaginatedResponse } from '../../common/types';

// Status constants
const JournalStatus = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
} as const;

@Injectable()
export class JournalService {
  constructor(
    private prisma: PrismaService,
    private postingService: PostingService,
  ) {}

  /**
   * Get journal types for an organization
   */
  async getJournalTypes(orgId: string) {
    return this.prisma.journalType.findMany({
      where: { orgId },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Create a new journal type
   */
  async createJournalType(
    orgId: string,
    dto: { code: string; name: string; description?: string },
  ) {
    // Check for duplicate code
    const existing = await this.prisma.journalType.findFirst({
      where: { orgId, code: dto.code },
    });

    if (existing) {
      throw new BadRequestException(`Journal type with code "${dto.code}" already exists`);
    }

    return this.prisma.journalType.create({
      data: {
        orgId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  /**
   * Update a journal type
   */
  async updateJournalType(
    orgId: string,
    journalTypeId: string,
    dto: { name?: string; description?: string },
  ) {
    const existing = await this.prisma.journalType.findUnique({
      where: { id: journalTypeId },
    });

    if (!existing || existing.orgId !== orgId) {
      throw new NotFoundException('Journal type not found');
    }

    return this.prisma.journalType.update({
      where: { id: journalTypeId },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  /**
   * Delete a journal type (only if no entries exist)
   */
  async deleteJournalType(orgId: string, journalTypeId: string) {
    const existing = await this.prisma.journalType.findUnique({
      where: { id: journalTypeId },
    });

    if (!existing || existing.orgId !== orgId) {
      throw new NotFoundException('Journal type not found');
    }

    // Check if there are any entries using this type
    const entriesCount = await this.prisma.journalEntry.count({
      where: { journalTypeId },
    });

    if (entriesCount > 0) {
      throw new BadRequestException(
        `Cannot delete journal type. ${entriesCount} journal entries are using this type.`,
      );
    }

    await this.prisma.journalType.delete({
      where: { id: journalTypeId },
    });

    return { success: true, message: 'Journal type deleted' };
  }

  /**
   * Create a new journal entry (draft)
   */
  async createJournalEntry(
    orgId: string,
    userId: string,
    dto: CreateJournalEntryDto,
  ) {
    // Validate journal type exists
    const journalType = await this.prisma.journalType.findUnique({
      where: { id: dto.journalTypeId },
    });

    if (!journalType || journalType.orgId !== orgId) {
      throw new BadRequestException('Invalid journal type');
    }

    const entryDate = new Date(dto.entryDate);

    // Find or create a period for this entry date
    let period = await this.prisma.period.findFirst({
      where: {
        orgId,
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
    });

    // If no period exists, create one for the entry date's month
    if (!period) {
      const startOfMonth = new Date(entryDate.getFullYear(), entryDate.getMonth(), 1);
      const endOfMonth = new Date(entryDate.getFullYear(), entryDate.getMonth() + 1, 0);
      const monthName = entryDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      period = await this.prisma.period.create({
        data: {
          orgId,
          name: monthName,
          startDate: startOfMonth,
          endDate: endOfMonth,
          status: 'OPEN',
        },
      });
    }

    if (period.status !== 'OPEN') {
      throw new BadRequestException('The accounting period for this date is closed.');
    }

    // Generate entry number
    const lastEntry = await this.prisma.journalEntry.findFirst({
      where: { orgId },
      orderBy: { entryNumber: 'desc' },
    });
    const nextNum = lastEntry
      ? parseInt(lastEntry.entryNumber.replace(/\D/g, '')) + 1
      : 1;
    const entryNumber = `JE-${String(nextNum).padStart(6, '0')}`;

    // Create journal entry with lines
    const journalEntry = await this.prisma.journalEntry.create({
      data: {
        orgId,
        journalTypeId: dto.journalTypeId,
        periodId: period.id,
        entryNumber,
        entryDate,
        description: dto.description,
        reference: dto.referenceNumber,
        status: JournalStatus.DRAFT,
        lines: {
          create: dto.lines.map((line, index) => ({
            lineNumber: index + 1,
            accountId: line.accountId,
            debitAmount: line.debitAmount ? new Decimal(line.debitAmount) : new Decimal(0),
            creditAmount: line.creditAmount ? new Decimal(line.creditAmount) : new Decimal(0),
            description: line.memo,
          })),
        },
      },
      include: {
        journalType: true,
        period: true,
        lines: {
          include: {
            account: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    // Audit event
    await this.prisma.auditEvent.create({
      data: {
        orgId,
        userId,
        action: AuditAction.JOURNAL_CREATED,
        entityType: 'journal_entry',
        entityId: journalEntry.id,
        newData: {
          description: dto.description,
          entryDate: dto.entryDate,
          linesCount: dto.lines.length,
        },
      },
    });

    return journalEntry;
  }

  /**
   * Get a single journal entry by ID
   */
  async getJournalEntry(orgId: string, journalEntryId: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id: journalEntryId },
      include: {
        journalType: true,
        period: true,
        lines: {
          include: {
            account: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
        reversalEntry: {
          select: { id: true, entryNumber: true },
        },
        reversedFrom: {
          select: { id: true, entryNumber: true },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.orgId !== orgId) {
      throw new ForbiddenException('Journal entry does not belong to this organization');
    }

    return entry;
  }

  /**
   * List journal entries with pagination and filters
   */
  async listJournalEntries(
    orgId: string,
    query: ListJournalsQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 50;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = { orgId };

    if (query.status && query.status !== JournalStatusFilter.ALL) {
      where.status = query.status.toUpperCase();
    }

    if (query.journalTypeId) {
      where.journalTypeId = query.journalTypeId;
    }

    if (query.startDate) {
      where.entryDate = { ...where.entryDate, gte: new Date(query.startDate) };
    }

    if (query.endDate) {
      where.entryDate = { ...where.entryDate, lte: new Date(query.endDate) };
    }

    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
        { entryNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Execute count and find in parallel
    const [total, entries] = await Promise.all([
      this.prisma.journalEntry.count({ where }),
      this.prisma.journalEntry.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          journalType: true,
          lines: {
            include: { account: true },
            orderBy: { lineNumber: 'asc' },
          },
        },
      }),
    ]);

    // Calculate totals for each entry
    const entriesWithTotals = entries.map((entry) => {
      let totalDebits = new Decimal(0);
      let totalCredits = new Decimal(0);

      for (const line of entry.lines) {
        if (line.debitAmount) totalDebits = totalDebits.plus(line.debitAmount);
        if (line.creditAmount) totalCredits = totalCredits.plus(line.creditAmount);
      }

      return {
        ...entry,
        totalDebits: totalDebits.toString(),
        totalCredits: totalCredits.toString(),
      };
    });

    return {
      data: entriesWithTotals,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update a draft journal entry
   */
  async updateJournalEntry(
    orgId: string,
    userId: string,
    journalEntryId: string,
    dto: UpdateJournalEntryDto,
  ) {
    const existing = await this.prisma.journalEntry.findUnique({
      where: { id: journalEntryId },
    });

    if (!existing) {
      throw new NotFoundException('Journal entry not found');
    }

    if (existing.orgId !== orgId) {
      throw new ForbiddenException('Journal entry does not belong to this organization');
    }

    if (existing.status !== JournalStatus.DRAFT) {
      throw new BadRequestException('Can only update draft journal entries');
    }

    // If lines are being updated, delete existing and recreate
    if (dto.lines) {
      await this.prisma.journalLine.deleteMany({
        where: { journalEntryId },
      });
    }

    // Build update data
    const updateData: any = {};
    if (dto.entryDate) updateData.entryDate = new Date(dto.entryDate);
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.referenceNumber !== undefined) updateData.reference = dto.referenceNumber;

    const updated = await this.prisma.journalEntry.update({
      where: { id: journalEntryId },
      data: updateData,
      include: {
        journalType: true,
        lines: {
          include: {
            account: true,
            dimensions: {
              include: {
                dimensionType: true,
                dimensionValue: true,
              },
            },
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    // If lines provided, recreate them
    if (dto.lines && dto.lines.length > 0) {
      // Delete existing lines already done above
      // Create new lines
      for (let index = 0; index < dto.lines.length; index++) {
        const line = dto.lines[index];
        await this.prisma.journalLine.create({
          data: {
            journalEntryId,
            lineNumber: index + 1,
            accountId: line.accountId,
            debitAmount: line.debitAmount ? new Decimal(line.debitAmount) : new Decimal(0),
            creditAmount: line.creditAmount ? new Decimal(line.creditAmount) : new Decimal(0),
            description: line.memo,
            dimensions: line.dimensions
              ? {
                  create: line.dimensions.map((dim) => ({
                    dimensionTypeId: dim.dimensionTypeId,
                    dimensionValueId: dim.dimensionValueId,
                  })),
                }
              : undefined,
          },
        });
      }

      // Refetch with updated lines
      return this.getJournalEntry(orgId, journalEntryId);
    }

    return updated;
  }

  /**
   * Delete a draft journal entry
   */
  async deleteJournalEntry(orgId: string, journalEntryId: string) {
    const existing = await this.prisma.journalEntry.findUnique({
      where: { id: journalEntryId },
    });

    if (!existing) {
      throw new NotFoundException('Journal entry not found');
    }

    if (existing.orgId !== orgId) {
      throw new ForbiddenException('Journal entry does not belong to this organization');
    }

    if (existing.status !== JournalStatus.DRAFT) {
      throw new BadRequestException('Can only delete draft journal entries');
    }

    await this.prisma.journalEntry.delete({
      where: { id: journalEntryId },
    });

    return { success: true, message: 'Journal entry deleted' };
  }

  /**
   * Delete ALL draft journal entries for an organization (for import reset)
   */
  async deleteAllDraftEntries(orgId: string) {
    // Count entries before deletion
    const count = await this.prisma.journalEntry.count({
      where: {
        orgId,
        status: JournalStatus.DRAFT,
      },
    });

    // Delete all draft entries
    await this.prisma.journalEntry.deleteMany({
      where: {
        orgId,
        status: JournalStatus.DRAFT,
      },
    });

    return { success: true, deleted: count, message: `Deleted ${count} draft journal entries` };
  }

  /**
   * Post a journal entry
   */
  async postJournalEntry(
    orgId: string,
    userId: string,
    journalEntryId: string,
  ) {
    return this.postingService.postJournal(journalEntryId, userId, orgId);
  }

  /**
   * Reverse a posted journal entry
   */
  async reverseJournalEntry(
    orgId: string,
    userId: string,
    journalEntryId: string,
    reversalDate?: Date,
  ) {
    return this.postingService.reverseJournal(
      journalEntryId,
      userId,
      orgId,
      reversalDate,
    );
  }

  /**
   * Unpost a journal entry (revert back to draft)
   */
  async unpostJournalEntry(
    orgId: string,
    userId: string,
    journalEntryId: string,
  ) {
    return this.postingService.unpostJournal(
      journalEntryId,
      userId,
      orgId,
    );
  }
}
