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
import { ArService } from './ar.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  CreateCustomerPaymentDto,
  ListCustomersQueryDto,
  ListInvoicesQueryDto,
} from './dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentOrg } from '../../decorators/current-org.decorator';
import type { OrgContext } from '../../common/types';

@Controller('ar')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ArController {
  constructor(private readonly arService: ArService) {}

  // ==================== CUSTOMERS ====================

  @Get('customers')
  async listCustomers(
    @CurrentOrg() orgContext: OrgContext,
    @Query() query: ListCustomersQueryDto,
  ) {
    return this.arService.listCustomers(orgContext.orgId, query);
  }

  @Get('customers/:id')
  async getCustomer(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.arService.getCustomer(orgContext.orgId, id);
  }

  @Post('customers')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @HttpCode(HttpStatus.CREATED)
  async createCustomer(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.arService.createCustomer(orgContext.orgId, dto);
  }

  @Put('customers/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async updateCustomer(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.arService.updateCustomer(orgContext.orgId, id, dto);
  }

  @Delete('customers/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async deleteCustomer(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.arService.deleteCustomer(orgContext.orgId, id);
  }

  // ==================== INVOICES ====================

  @Get('invoices')
  async listInvoices(
    @CurrentOrg() orgContext: OrgContext,
    @Query() query: ListInvoicesQueryDto,
  ) {
    return this.arService.listInvoices(orgContext.orgId, query);
  }

  @Get('invoices/:id')
  async getInvoice(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.arService.getInvoice(orgContext.orgId, id);
  }

  @Post('invoices')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @HttpCode(HttpStatus.CREATED)
  async createInvoice(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.arService.createInvoice(orgContext.orgId, orgContext.userId, dto);
  }

  @Put('invoices/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async updateInvoice(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.arService.updateInvoice(orgContext.orgId, orgContext.userId, id, dto);
  }

  @Delete('invoices/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async deleteInvoice(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.arService.deleteInvoice(orgContext.orgId, id);
  }

  @Post('invoices/:id/post')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @HttpCode(HttpStatus.OK)
  async postInvoice(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.arService.postInvoice(orgContext.orgId, orgContext.userId, id);
  }

  // ==================== CUSTOMER PAYMENTS ====================

  @Get('payments')
  async listPayments(
    @CurrentOrg() orgContext: OrgContext,
    @Query('invoiceId') invoiceId?: string,
  ) {
    return this.arService.getCustomerPayments(orgContext.orgId, invoiceId);
  }

  @Post('payments')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @HttpCode(HttpStatus.CREATED)
  async createPayment(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: CreateCustomerPaymentDto,
  ) {
    return this.arService.createCustomerPayment(orgContext.orgId, orgContext.userId, dto);
  }

  @Post('payments/:id/post')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @HttpCode(HttpStatus.OK)
  async postPayment(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.arService.postCustomerPayment(orgContext.orgId, orgContext.userId, id);
  }

  // ==================== SUMMARY ====================

  @Get('summary')
  async getSummary(@CurrentOrg() orgContext: OrgContext) {
    return this.arService.getArSummary(orgContext.orgId);
  }
}
