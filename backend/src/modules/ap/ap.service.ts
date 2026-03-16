import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  CreateVendorDto,
  UpdateVendorDto,
  CreateBillDto,
  UpdateBillDto,
  CreateBillPaymentDto,
  ListVendorsQueryDto,
  ListBillsQueryDto,
} from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ApService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== VENDORS ====================

  async listVendors(orgId: string, query: ListVendorsQueryDto) {
    const { status, search, page = 1, pageSize = 50 } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.VendorWhereInput = { orgId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { vendorCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: 'asc' },
        include: {
          defaultAccount: {
            select: { id: true, accountCode: true, title: true },
          },
        },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getVendor(orgId: string, vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, orgId },
      include: {
        defaultAccount: {
          select: { id: true, accountCode: true, title: true },
        },
        bills: {
          take: 10,
          orderBy: { billDate: 'desc' },
          select: {
            id: true,
            billNumber: true,
            billDate: true,
            totalAmount: true,
            amountPaid: true,
            status: true,
          },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  async createVendor(orgId: string, dto: CreateVendorDto) {
    // Generate vendor code if not provided
    const vendorCode = dto.vendorCode || await this.generateVendorCode(orgId);

    return this.prisma.vendor.create({
      data: {
        orgId,
        ...dto,
        vendorCode,
      },
      include: {
        defaultAccount: {
          select: { id: true, accountCode: true, title: true },
        },
      },
    });
  }

  async updateVendor(orgId: string, vendorId: string, dto: UpdateVendorDto) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, orgId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: dto,
      include: {
        defaultAccount: {
          select: { id: true, accountCode: true, title: true },
        },
      },
    });
  }

  async deleteVendor(orgId: string, vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, orgId },
      include: { bills: { take: 1 } },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (vendor.bills.length > 0) {
      throw new BadRequestException('Cannot delete vendor with existing bills');
    }

    await this.prisma.vendor.delete({ where: { id: vendorId } });
    return { success: true };
  }

  private async generateVendorCode(orgId: string): Promise<string> {
    const lastVendor = await this.prisma.vendor.findFirst({
      where: { orgId },
      orderBy: { vendorCode: 'desc' },
    });

    if (!lastVendor) {
      return 'V-0001';
    }

    const match = lastVendor.vendorCode.match(/V-(\d+)/);
    if (match) {
      const nextNumber = parseInt(match[1], 10) + 1;
      return `V-${nextNumber.toString().padStart(4, '0')}`;
    }

    return `V-${Date.now()}`;
  }

  // ==================== BILLS ====================

  async listBills(orgId: string, query: ListBillsQueryDto) {
    const { vendorId, status, startDate, endDate, page = 1, pageSize = 50 } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.BillWhereInput = { orgId };

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (status) {
      where.status = status as any;
    }

    if (startDate || endDate) {
      where.billDate = {};
      if (startDate) {
        where.billDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.billDate.lte = new Date(endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.bill.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { billDate: 'desc' },
        include: {
          vendor: {
            select: { id: true, vendorCode: true, name: true },
          },
          lines: {
            orderBy: { lineNumber: 'asc' },
          },
        },
      }),
      this.prisma.bill.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getBill(orgId: string, billId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, orgId },
      include: {
        vendor: {
          select: { id: true, vendorCode: true, name: true, email: true },
        },
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return bill;
  }

  async createBill(orgId: string, userId: string, dto: CreateBillDto) {
    const billNumber = await this.generateBillNumber(orgId);

    // Calculate totals
    const subtotal = dto.lines.reduce((sum, line) => sum + line.amount, 0);
    const totalAmount = subtotal; // Add tax handling if needed

    const bill = await this.prisma.bill.create({
      data: {
        orgId,
        billNumber,
        vendorId: dto.vendorId,
        vendorInvoiceNo: dto.vendorInvoiceNo,
        billDate: new Date(dto.billDate),
        dueDate: new Date(dto.dueDate),
        description: dto.description,
        apAccountId: dto.apAccountId,
        subtotal,
        totalAmount,
        lines: {
          create: dto.lines.map((line, index) => ({
            lineNumber: index + 1,
            accountId: line.accountId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            amount: line.amount,
          })),
        },
      },
      include: {
        vendor: {
          select: { id: true, vendorCode: true, name: true },
        },
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    return bill;
  }

  async updateBill(orgId: string, userId: string, billId: string, dto: UpdateBillDto) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, orgId },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    if (bill.status !== 'DRAFT') {
      throw new BadRequestException('Only draft bills can be edited');
    }

    const updateData: Prisma.BillUpdateInput = {};

    if (dto.vendorInvoiceNo !== undefined) updateData.vendorInvoiceNo = dto.vendorInvoiceNo;
    if (dto.billDate) updateData.billDate = new Date(dto.billDate);
    if (dto.dueDate) updateData.dueDate = new Date(dto.dueDate);
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.apAccountId) updateData.apAccountId = dto.apAccountId;

    // Update lines if provided
    if (dto.lines) {
      await this.prisma.billLine.deleteMany({ where: { billId } });

      const subtotal = dto.lines.reduce((sum, line) => sum + line.amount, 0);
      updateData.subtotal = subtotal;
      updateData.totalAmount = subtotal;

      updateData.lines = {
        create: dto.lines.map((line, index) => ({
          lineNumber: index + 1,
          accountId: line.accountId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: line.amount,
        })),
      };
    }

    return this.prisma.bill.update({
      where: { id: billId },
      data: updateData,
      include: {
        vendor: {
          select: { id: true, vendorCode: true, name: true },
        },
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });
  }

  async deleteBill(orgId: string, billId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, orgId },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    if (bill.status !== 'DRAFT') {
      throw new BadRequestException('Only draft bills can be deleted');
    }

    await this.prisma.bill.delete({ where: { id: billId } });
    return { success: true };
  }

  async postBill(orgId: string, userId: string, billId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, orgId },
      include: { lines: true },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    if (bill.status !== 'DRAFT' && bill.status !== 'APPROVED') {
      throw new BadRequestException('Bill is not in a state that can be posted');
    }

    // TODO: Create journal entry for the bill
    // Debit: Expense accounts (from lines)
    // Credit: AP Account

    return this.prisma.bill.update({
      where: { id: billId },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: userId,
      },
      include: {
        vendor: {
          select: { id: true, vendorCode: true, name: true },
        },
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });
  }

  private async generateBillNumber(orgId: string): Promise<string> {
    const lastBill = await this.prisma.bill.findFirst({
      where: { orgId },
      orderBy: { billNumber: 'desc' },
    });

    if (!lastBill) {
      return 'BILL-0001';
    }

    const match = lastBill.billNumber.match(/BILL-(\d+)/);
    if (match) {
      const nextNumber = parseInt(match[1], 10) + 1;
      return `BILL-${nextNumber.toString().padStart(4, '0')}`;
    }

    return `BILL-${Date.now()}`;
  }

  // ==================== BILL PAYMENTS ====================

  async createBillPayment(orgId: string, userId: string, dto: CreateBillPaymentDto) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: dto.billId, orgId },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const remainingAmount = Number(bill.totalAmount) - Number(bill.amountPaid);
    if (dto.amount > remainingAmount) {
      throw new BadRequestException(`Payment amount exceeds remaining balance of ${remainingAmount}`);
    }

    const paymentNumber = await this.generatePaymentNumber(orgId);

    const payment = await this.prisma.billPayment.create({
      data: {
        orgId,
        vendorId: bill.vendorId,
        billId: dto.billId,
        paymentNumber,
        paymentDate: new Date(dto.paymentDate),
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber,
        bankAccountId: dto.bankAccountId,
        memo: dto.memo,
      },
      include: {
        vendor: {
          select: { id: true, vendorCode: true, name: true },
        },
        bill: {
          select: { id: true, billNumber: true, totalAmount: true },
        },
      },
    });

    // Update bill amount paid
    const newAmountPaid = Number(bill.amountPaid) + dto.amount;
    const newStatus = newAmountPaid >= Number(bill.totalAmount) ? 'PAID' : 'PARTIALLY_PAID';

    await this.prisma.bill.update({
      where: { id: dto.billId },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
      },
    });

    return payment;
  }

  async postBillPayment(orgId: string, userId: string, paymentId: string) {
    const payment = await this.prisma.billPayment.findFirst({
      where: { id: paymentId, orgId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== 'DRAFT') {
      throw new BadRequestException('Payment is not in draft status');
    }

    // TODO: Create journal entry for the payment
    // Debit: AP Account
    // Credit: Bank Account

    return this.prisma.billPayment.update({
      where: { id: paymentId },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: userId,
      },
      include: {
        vendor: {
          select: { id: true, vendorCode: true, name: true },
        },
        bill: {
          select: { id: true, billNumber: true, totalAmount: true },
        },
      },
    });
  }

  async getBillPayments(orgId: string, billId?: string) {
    const where: Prisma.BillPaymentWhereInput = { orgId };
    if (billId) {
      where.billId = billId;
    }

    return this.prisma.billPayment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        vendor: {
          select: { id: true, vendorCode: true, name: true },
        },
        bill: {
          select: { id: true, billNumber: true, totalAmount: true },
        },
      },
    });
  }

  private async generatePaymentNumber(orgId: string): Promise<string> {
    const lastPayment = await this.prisma.billPayment.findFirst({
      where: { orgId },
      orderBy: { paymentNumber: 'desc' },
    });

    if (!lastPayment) {
      return 'PMT-0001';
    }

    const match = lastPayment.paymentNumber.match(/PMT-(\d+)/);
    if (match) {
      const nextNumber = parseInt(match[1], 10) + 1;
      return `PMT-${nextNumber.toString().padStart(4, '0')}`;
    }

    return `PMT-${Date.now()}`;
  }

  // ==================== AP SUMMARY ====================

  async getApSummary(orgId: string) {
    const [vendors, bills, overdueCount, totalOutstanding] = await Promise.all([
      this.prisma.vendor.count({ where: { orgId, status: 'ACTIVE' } }),
      this.prisma.bill.groupBy({
        by: ['status'],
        where: { orgId },
        _count: true,
        _sum: { totalAmount: true, amountPaid: true },
      }),
      this.prisma.bill.count({
        where: {
          orgId,
          status: { in: ['POSTED', 'PARTIALLY_PAID'] },
          dueDate: { lt: new Date() },
        },
      }),
      this.prisma.bill.aggregate({
        where: {
          orgId,
          status: { in: ['POSTED', 'PARTIALLY_PAID'] },
        },
        _sum: { totalAmount: true, amountPaid: true },
      }),
    ]);

    const outstanding = (Number(totalOutstanding._sum.totalAmount) || 0) - (Number(totalOutstanding._sum.amountPaid) || 0);

    return {
      activeVendors: vendors,
      billsByStatus: bills,
      overdueCount,
      totalOutstanding: outstanding,
    };
  }
}
