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
import { ApService } from './ap.service';
import {
  CreateVendorDto,
  UpdateVendorDto,
  CreateBillDto,
  UpdateBillDto,
  CreateBillPaymentDto,
  ListVendorsQueryDto,
  ListBillsQueryDto,
} from './dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentOrg } from '../../decorators/current-org.decorator';
import type { OrgContext } from '../../common/types';

@Controller('ap')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ApController {
  constructor(private readonly apService: ApService) {}

  // ==================== VENDORS ====================

  @Get('vendors')
  async listVendors(
    @CurrentOrg() orgContext: OrgContext,
    @Query() query: ListVendorsQueryDto,
  ) {
    return this.apService.listVendors(orgContext.orgId, query);
  }

  @Get('vendors/:id')
  async getVendor(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.apService.getVendor(orgContext.orgId, id);
  }

  @Post('vendors')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @HttpCode(HttpStatus.CREATED)
  async createVendor(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: CreateVendorDto,
  ) {
    return this.apService.createVendor(orgContext.orgId, dto);
  }

  @Put('vendors/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async updateVendor(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.apService.updateVendor(orgContext.orgId, id, dto);
  }

  @Delete('vendors/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async deleteVendor(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.apService.deleteVendor(orgContext.orgId, id);
  }

  // ==================== BILLS ====================

  @Get('bills')
  async listBills(
    @CurrentOrg() orgContext: OrgContext,
    @Query() query: ListBillsQueryDto,
  ) {
    return this.apService.listBills(orgContext.orgId, query);
  }

  @Get('bills/:id')
  async getBill(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.apService.getBill(orgContext.orgId, id);
  }

  @Post('bills')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @HttpCode(HttpStatus.CREATED)
  async createBill(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: CreateBillDto,
  ) {
    return this.apService.createBill(orgContext.orgId, orgContext.userId, dto);
  }

  @Put('bills/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async updateBill(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateBillDto,
  ) {
    return this.apService.updateBill(orgContext.orgId, orgContext.userId, id, dto);
  }

  @Delete('bills/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async deleteBill(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.apService.deleteBill(orgContext.orgId, id);
  }

  @Post('bills/:id/post')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @HttpCode(HttpStatus.OK)
  async postBill(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.apService.postBill(orgContext.orgId, orgContext.userId, id);
  }

  // ==================== BILL PAYMENTS ====================

  @Get('payments')
  async listPayments(
    @CurrentOrg() orgContext: OrgContext,
    @Query('billId') billId?: string,
  ) {
    return this.apService.getBillPayments(orgContext.orgId, billId);
  }

  @Post('payments')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @HttpCode(HttpStatus.CREATED)
  async createPayment(
    @CurrentOrg() orgContext: OrgContext,
    @Body() dto: CreateBillPaymentDto,
  ) {
    return this.apService.createBillPayment(orgContext.orgId, orgContext.userId, dto);
  }

  @Post('payments/:id/post')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @HttpCode(HttpStatus.OK)
  async postPayment(
    @CurrentOrg() orgContext: OrgContext,
    @Param('id') id: string,
  ) {
    return this.apService.postBillPayment(orgContext.orgId, orgContext.userId, id);
  }

  // ==================== SUMMARY ====================

  @Get('summary')
  async getSummary(@CurrentOrg() orgContext: OrgContext) {
    return this.apService.getApSummary(orgContext.orgId);
  }
}
