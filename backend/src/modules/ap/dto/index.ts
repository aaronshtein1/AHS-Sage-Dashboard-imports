import { IsString, IsOptional, IsNumber, IsArray, IsDateString, IsEnum, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ==================== VENDOR DTOs ====================

export class CreateVendorDto {
  @IsString()
  vendorCode: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @IsString()
  @IsOptional()
  defaultAccountId?: string;

  @IsString()
  @IsOptional()
  addressLine1?: string;

  @IsString()
  @IsOptional()
  addressLine2?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  zipCode?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateVendorDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @IsString()
  @IsOptional()
  defaultAccountId?: string;

  @IsString()
  @IsOptional()
  addressLine1?: string;

  @IsString()
  @IsOptional()
  addressLine2?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  zipCode?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  status?: 'ACTIVE' | 'INACTIVE';
}

// ==================== BILL DTOs ====================

export class BillLineDto {
  @IsString()
  accountId: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  amount: number;
}

export class CreateBillDto {
  @IsString()
  vendorId: string;

  @IsString()
  @IsOptional()
  vendorInvoiceNo?: string;

  @IsDateString()
  billDate: string;

  @IsDateString()
  dueDate: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  apAccountId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillLineDto)
  lines: BillLineDto[];
}

export class UpdateBillDto {
  @IsString()
  @IsOptional()
  vendorInvoiceNo?: string;

  @IsDateString()
  @IsOptional()
  billDate?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  apAccountId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillLineDto)
  @IsOptional()
  lines?: BillLineDto[];
}

// ==================== BILL PAYMENT DTOs ====================

export class CreateBillPaymentDto {
  @IsString()
  billId: string;

  @IsDateString()
  paymentDate: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsString()
  bankAccountId: string;

  @IsString()
  @IsOptional()
  memo?: string;
}

// ==================== QUERY DTOs ====================

export class ListVendorsQueryDto {
  @IsString()
  @IsOptional()
  status?: 'ACTIVE' | 'INACTIVE';

  @IsString()
  @IsOptional()
  search?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}

export class ListBillsQueryDto {
  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}
