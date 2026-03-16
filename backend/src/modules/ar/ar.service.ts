import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  CreateCustomerPaymentDto,
  ListCustomersQueryDto,
  ListInvoicesQueryDto,
} from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ArService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== CUSTOMERS ====================

  async listCustomers(orgId: string, query: ListCustomersQueryDto) {
    const { status, search, page = 1, pageSize = 50 } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CustomerWhereInput = { orgId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { customerCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
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
      this.prisma.customer.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getCustomer(orgId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, orgId },
      include: {
        defaultAccount: {
          select: { id: true, accountCode: true, title: true },
        },
        invoices: {
          take: 10,
          orderBy: { invoiceDate: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            totalAmount: true,
            amountPaid: true,
            status: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async createCustomer(orgId: string, dto: CreateCustomerDto) {
    const customerCode = dto.customerCode || await this.generateCustomerCode(orgId);

    return this.prisma.customer.create({
      data: {
        orgId,
        ...dto,
        customerCode,
      },
      include: {
        defaultAccount: {
          select: { id: true, accountCode: true, title: true },
        },
      },
    });
  }

  async updateCustomer(orgId: string, customerId: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, orgId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.customer.update({
      where: { id: customerId },
      data: dto,
      include: {
        defaultAccount: {
          select: { id: true, accountCode: true, title: true },
        },
      },
    });
  }

  async deleteCustomer(orgId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, orgId },
      include: { invoices: { take: 1 } },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.invoices.length > 0) {
      throw new BadRequestException('Cannot delete customer with existing invoices');
    }

    await this.prisma.customer.delete({ where: { id: customerId } });
    return { success: true };
  }

  private async generateCustomerCode(orgId: string): Promise<string> {
    const lastCustomer = await this.prisma.customer.findFirst({
      where: { orgId },
      orderBy: { customerCode: 'desc' },
    });

    if (!lastCustomer) {
      return 'C-0001';
    }

    const match = lastCustomer.customerCode.match(/C-(\d+)/);
    if (match) {
      const nextNumber = parseInt(match[1], 10) + 1;
      return `C-${nextNumber.toString().padStart(4, '0')}`;
    }

    return `C-${Date.now()}`;
  }

  // ==================== INVOICES ====================

  async listInvoices(orgId: string, query: ListInvoicesQueryDto) {
    const { customerId, status, startDate, endDate, page = 1, pageSize = 50 } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.InvoiceWhereInput = { orgId };

    if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      where.status = status as any;
    }

    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) {
        where.invoiceDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.invoiceDate.lte = new Date(endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { invoiceDate: 'desc' },
        include: {
          customer: {
            select: { id: true, customerCode: true, name: true },
          },
          lines: {
            orderBy: { lineNumber: 'asc' },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getInvoice(orgId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, orgId },
      include: {
        customer: {
          select: { id: true, customerCode: true, name: true, email: true },
        },
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async createInvoice(orgId: string, userId: string, dto: CreateInvoiceDto) {
    const invoiceNumber = await this.generateInvoiceNumber(orgId);

    const subtotal = dto.lines.reduce((sum, line) => sum + line.amount, 0);
    const totalAmount = subtotal;

    const invoice = await this.prisma.invoice.create({
      data: {
        orgId,
        invoiceNumber,
        customerId: dto.customerId,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: new Date(dto.dueDate),
        description: dto.description,
        arAccountId: dto.arAccountId,
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
        customer: {
          select: { id: true, customerCode: true, name: true },
        },
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    return invoice;
  }

  async updateInvoice(orgId: string, userId: string, invoiceId: string, dto: UpdateInvoiceDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, orgId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only draft invoices can be edited');
    }

    const updateData: Prisma.InvoiceUpdateInput = {};

    if (dto.invoiceDate) updateData.invoiceDate = new Date(dto.invoiceDate);
    if (dto.dueDate) updateData.dueDate = new Date(dto.dueDate);
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.arAccountId) updateData.arAccountId = dto.arAccountId;

    if (dto.lines) {
      await this.prisma.invoiceLine.deleteMany({ where: { invoiceId } });

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

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        customer: {
          select: { id: true, customerCode: true, name: true },
        },
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });
  }

  async deleteInvoice(orgId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, orgId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only draft invoices can be deleted');
    }

    await this.prisma.invoice.delete({ where: { id: invoiceId } });
    return { success: true };
  }

  async postInvoice(orgId: string, userId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, orgId },
      include: { lines: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== 'DRAFT' && invoice.status !== 'APPROVED') {
      throw new BadRequestException('Invoice is not in a state that can be posted');
    }

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: userId,
      },
      include: {
        customer: {
          select: { id: true, customerCode: true, name: true },
        },
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });
  }

  private async generateInvoiceNumber(orgId: string): Promise<string> {
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { orgId },
      orderBy: { invoiceNumber: 'desc' },
    });

    if (!lastInvoice) {
      return 'INV-0001';
    }

    const match = lastInvoice.invoiceNumber.match(/INV-(\d+)/);
    if (match) {
      const nextNumber = parseInt(match[1], 10) + 1;
      return `INV-${nextNumber.toString().padStart(4, '0')}`;
    }

    return `INV-${Date.now()}`;
  }

  // ==================== CUSTOMER PAYMENTS ====================

  async createCustomerPayment(orgId: string, userId: string, dto: CreateCustomerPaymentDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, orgId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const remainingAmount = Number(invoice.totalAmount) - Number(invoice.amountPaid);
    if (dto.amount > remainingAmount) {
      throw new BadRequestException(`Payment amount exceeds remaining balance of ${remainingAmount}`);
    }

    const paymentNumber = await this.generateReceiptNumber(orgId);

    const payment = await this.prisma.customerPayment.create({
      data: {
        orgId,
        customerId: invoice.customerId,
        invoiceId: dto.invoiceId,
        paymentNumber,
        paymentDate: new Date(dto.paymentDate),
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber,
        bankAccountId: dto.bankAccountId,
        memo: dto.memo,
      },
      include: {
        customer: {
          select: { id: true, customerCode: true, name: true },
        },
        invoice: {
          select: { id: true, invoiceNumber: true, totalAmount: true },
        },
      },
    });

    const newAmountPaid = Number(invoice.amountPaid) + dto.amount;
    const newStatus = newAmountPaid >= Number(invoice.totalAmount) ? 'PAID' : 'PARTIALLY_PAID';

    await this.prisma.invoice.update({
      where: { id: dto.invoiceId },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
      },
    });

    return payment;
  }

  async postCustomerPayment(orgId: string, userId: string, paymentId: string) {
    const payment = await this.prisma.customerPayment.findFirst({
      where: { id: paymentId, orgId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== 'DRAFT') {
      throw new BadRequestException('Payment is not in draft status');
    }

    return this.prisma.customerPayment.update({
      where: { id: paymentId },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: userId,
      },
      include: {
        customer: {
          select: { id: true, customerCode: true, name: true },
        },
        invoice: {
          select: { id: true, invoiceNumber: true, totalAmount: true },
        },
      },
    });
  }

  async getCustomerPayments(orgId: string, invoiceId?: string) {
    const where: Prisma.CustomerPaymentWhereInput = { orgId };
    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    return this.prisma.customerPayment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        customer: {
          select: { id: true, customerCode: true, name: true },
        },
        invoice: {
          select: { id: true, invoiceNumber: true, totalAmount: true },
        },
      },
    });
  }

  private async generateReceiptNumber(orgId: string): Promise<string> {
    const lastPayment = await this.prisma.customerPayment.findFirst({
      where: { orgId },
      orderBy: { paymentNumber: 'desc' },
    });

    if (!lastPayment) {
      return 'RCP-0001';
    }

    const match = lastPayment.paymentNumber.match(/RCP-(\d+)/);
    if (match) {
      const nextNumber = parseInt(match[1], 10) + 1;
      return `RCP-${nextNumber.toString().padStart(4, '0')}`;
    }

    return `RCP-${Date.now()}`;
  }

  // ==================== AR SUMMARY ====================

  async getArSummary(orgId: string) {
    const [customers, invoices, overdueCount, totalOutstanding] = await Promise.all([
      this.prisma.customer.count({ where: { orgId, status: 'ACTIVE' } }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { orgId },
        _count: true,
        _sum: { totalAmount: true, amountPaid: true },
      }),
      this.prisma.invoice.count({
        where: {
          orgId,
          status: { in: ['POSTED', 'PARTIALLY_PAID'] },
          dueDate: { lt: new Date() },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          orgId,
          status: { in: ['POSTED', 'PARTIALLY_PAID'] },
        },
        _sum: { totalAmount: true, amountPaid: true },
      }),
    ]);

    const outstanding = (Number(totalOutstanding._sum.totalAmount) || 0) - (Number(totalOutstanding._sum.amountPaid) || 0);

    return {
      activeCustomers: customers,
      invoicesByStatus: invoices,
      overdueCount,
      totalOutstanding: outstanding,
    };
  }
}
