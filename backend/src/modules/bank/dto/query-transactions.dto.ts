import { IsString, IsOptional, IsDateString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum TransactionStatus {
  UNCATEGORIZED = 'uncategorized',
  CATEGORIZED = 'categorized',
  JOURNALED = 'journaled',
}

export class QueryTransactionsDto {
  @IsOptional()
  @IsString()
  plaidAccountId?: string;

  @IsOptional()
  @IsString()
  accountId?: string; // GL account filter

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pageSize?: number = 50;
}
