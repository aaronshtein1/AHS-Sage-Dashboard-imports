import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AccountType, NormalBalance, ClosingType, AccountStatus, AuditAction } from '@prisma/client';

interface CreateAccountDto {
  accountCode: string;
  title: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  closingType: ClosingType;
  closeIntoAccountId?: string;
  parentAccountId?: string;
  category?: string;
  disallowDirectPosting?: boolean;
  isBankAccount?: boolean;
  bankName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  requiredDimensionTypeIds?: string[];
}

interface UpdateAccountDto {
  title?: string;
  category?: string;
  disallowDirectPosting?: boolean;
  status?: AccountStatus;
  closeIntoAccountId?: string;
  requiredDimensionTypeIds?: string[];
}

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all accounts for an organization
   */
  async getAccounts(
    orgId: string,
    options: {
      includeInactive?: boolean;
      accountType?: AccountType;
      isBankAccount?: boolean;
    } = {},
  ) {
    const where: any = { orgId };

    if (!options.includeInactive) {
      where.status = AccountStatus.ACTIVE;
    }

    if (options.accountType) {
      where.accountType = options.accountType;
    }

    if (options.isBankAccount !== undefined) {
      where.isBankAccount = options.isBankAccount;
    }

    return this.prisma.account.findMany({
      where,
      include: {
        parentAccount: { select: { id: true, accountCode: true, title: true } },
        closeIntoAccount: { select: { id: true, accountCode: true, title: true } },
        requiredDimensions: {
          include: {
            dimensionType: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { accountCode: 'asc' },
    });
  }

  /**
   * Get a single account by ID
   */
  async getAccount(orgId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: {
        parentAccount: { select: { id: true, accountCode: true, title: true } },
        closeIntoAccount: { select: { id: true, accountCode: true, title: true } },
        childAccounts: { select: { id: true, accountCode: true, title: true } },
        requiredDimensions: {
          include: {
            dimensionType: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.orgId !== orgId) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }

  /**
   * Create a new account
   */
  async createAccount(orgId: string, userId: string, dto: CreateAccountDto) {
    // Check for duplicate account code
    const existing = await this.prisma.account.findUnique({
      where: { orgId_accountCode: { orgId, accountCode: dto.accountCode } },
    });

    if (existing) {
      throw new ConflictException(`Account code ${dto.accountCode} already exists`);
    }

    // Validate closing type matches account type
    if (dto.accountType === AccountType.REVENUE || dto.accountType === AccountType.EXPENSE) {
      if (dto.closingType !== ClosingType.CLOSING) {
        throw new BadRequestException('Revenue and Expense accounts must be CLOSING type');
      }
    } else {
      if (dto.closingType !== ClosingType.NON_CLOSING) {
        throw new BadRequestException('Asset, Liability, and Equity accounts must be NON_CLOSING type');
      }
    }

    // Create account
    const account = await this.prisma.account.create({
      data: {
        orgId,
        accountCode: dto.accountCode,
        title: dto.title,
        accountType: dto.accountType,
        normalBalance: dto.normalBalance,
        closingType: dto.closingType,
        closeIntoAccountId: dto.closeIntoAccountId,
        parentAccountId: dto.parentAccountId,
        category: dto.category,
        disallowDirectPosting: dto.disallowDirectPosting || false,
        isBankAccount: dto.isBankAccount || false,
        bankName: dto.bankName,
        bankAccountNumber: dto.bankAccountNumber,
        bankRoutingNumber: dto.bankRoutingNumber,
        requiredDimensions: dto.requiredDimensionTypeIds
          ? {
              create: dto.requiredDimensionTypeIds.map((dimTypeId) => ({
                orgId,
                dimensionTypeId: dimTypeId,
              })),
            }
          : undefined,
      },
      include: {
        requiredDimensions: {
          include: { dimensionType: true },
        },
      },
    });

    // Audit event
    await this.prisma.auditEvent.create({
      data: {
        orgId,
        userId,
        action: AuditAction.ACCOUNT_CREATED,
        entityType: 'account',
        entityId: account.id,
        newData: {
          accountCode: dto.accountCode,
          title: dto.title,
          accountType: dto.accountType,
        },
      },
    });

    return account;
  }

  /**
   * Update an account
   */
  async updateAccount(
    orgId: string,
    userId: string,
    accountId: string,
    dto: UpdateAccountDto,
  ) {
    const existing = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: {
        requiredDimensions: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    if (existing.orgId !== orgId) {
      throw new NotFoundException('Account not found');
    }

    // Check if account has postings before allowing deactivation
    if (dto.status === AccountStatus.INACTIVE) {
      const hasPostings = await this.prisma.ledgerPosting.findFirst({
        where: { accountId },
      });

      if (hasPostings) {
        // Allow deactivation but warn - account will still show in historical reports
        console.log(`Account ${existing.accountCode} has historical postings`);
      }
    }

    // Update required dimensions if provided
    if (dto.requiredDimensionTypeIds !== undefined) {
      // Delete existing
      await this.prisma.accountRequiredDimension.deleteMany({
        where: { accountId },
      });

      // Create new
      if (dto.requiredDimensionTypeIds.length > 0) {
        await this.prisma.accountRequiredDimension.createMany({
          data: dto.requiredDimensionTypeIds.map((dimTypeId) => ({
            orgId,
            accountId,
            dimensionTypeId: dimTypeId,
          })),
        });
      }
    }

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        title: dto.title,
        category: dto.category,
        disallowDirectPosting: dto.disallowDirectPosting,
        status: dto.status,
        closeIntoAccountId: dto.closeIntoAccountId,
      },
      include: {
        requiredDimensions: {
          include: { dimensionType: true },
        },
      },
    });

    // Audit event
    await this.prisma.auditEvent.create({
      data: {
        orgId,
        userId,
        action: AuditAction.ACCOUNT_UPDATED,
        entityType: 'account',
        entityId: accountId,
        previousData: {
          title: existing.title,
          status: existing.status,
        },
        newData: {
          title: updated.title,
          status: updated.status,
        },
      },
    });

    return updated;
  }

  /**
   * Get dimension types for an organization
   */
  async getDimensionTypes(orgId: string) {
    return this.prisma.dimensionType.findMany({
      where: { orgId },
      include: {
        values: {
          where: { status: { not: 'INACTIVE' } },
          orderBy: { code: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Get dimension values for a type
   */
  async getDimensionValues(orgId: string, dimensionTypeId: string) {
    return this.prisma.dimensionValue.findMany({
      where: { orgId, dimensionTypeId },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Get all dimension values for an organization
   */
  async getAllDimensionValues(orgId: string) {
    const dimensionValues = await this.prisma.dimensionValue.findMany({
      where: { orgId, status: { not: 'INACTIVE' } },
      include: {
        dimensionType: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: [{ dimensionType: { sortOrder: 'asc' } }, { code: 'asc' }],
    });

    // Transform to include dimensionTypeCode for easier frontend use
    return dimensionValues.map((dv) => ({
      id: dv.id,
      code: dv.code,
      name: dv.name,
      description: dv.description,
      dimensionTypeId: dv.dimensionTypeId,
      dimensionTypeCode: dv.dimensionType.code,
      dimensionTypeName: dv.dimensionType.name,
    }));
  }
}
