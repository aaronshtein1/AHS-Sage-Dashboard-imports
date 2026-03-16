import { IsString, IsDateString, IsOptional, IsArray, ValidateNested, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class JournalLineDimensionDto {
  @IsString()
  dimensionTypeId: string;

  @IsString()
  dimensionValueId: string;
}

export class CreateJournalLineDto {
  @IsString()
  accountId: string;

  @IsOptional()
  @IsString()
  debitAmount?: string;

  @IsOptional()
  @IsString()
  creditAmount?: string;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDimensionDto)
  dimensions?: JournalLineDimensionDto[];
}

export class CreateJournalEntryDto {
  @IsString()
  journalTypeId: string;

  @IsDateString()
  entryDate: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsDateString()
  automaticReversalDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines: CreateJournalLineDto[];
}

export class UpdateJournalEntryDto {
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsDateString()
  automaticReversalDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines?: CreateJournalLineDto[];
}

export enum JournalStatusFilter {
  ALL = 'all',
  DRAFT = 'draft',
  POSTED = 'posted',
  REVERSED = 'reversed',
}

export class ListJournalsQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pageSize?: number = 50;

  @IsOptional()
  @IsEnum(JournalStatusFilter)
  status?: JournalStatusFilter;

  @IsOptional()
  @IsString()
  journalTypeId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class PostJournalDto {
  @IsOptional()
  @IsDateString()
  postingDate?: string;
}

export class ReverseJournalDto {
  @IsOptional()
  @IsDateString()
  reversalDate?: string;
}
