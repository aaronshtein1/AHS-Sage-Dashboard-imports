import { IsString, IsOptional, IsNumber, IsArray, IsDateString, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ==================== CUSTOMER DTOs ====================

export class CreateCustomerDto {
  @IsString()
  customerCode: string;

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

export class UpdateCustomerDto {
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

// ==================== INVOICE DTOs ====================

export class InvoiceLineDto {
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

export class CreateInvoiceDto {
  @IsString()
  customerId: string;

  @IsDateString()
  invoiceDate: string;

  @IsDateString()
  dueDate: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  arAccountId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines: InvoiceLineDto[];
}

export class UpdateInvoiceDto {
  @IsDateString()
  @IsOptional()
  invoiceDate?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  arAccountId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  @IsOptional()
  lines?: InvoiceLineDto[];
}

// ==================== CUSTOMER PAYMENT DTOs ====================

export class CreateCustomerPaymentDto {
  @IsString()
  invoiceId: string;

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

export class ListCustomersQueryDto {
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

export class ListInvoicesQueryDto {
  @IsString()
  @IsOptional()
  customerId?: string;

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
