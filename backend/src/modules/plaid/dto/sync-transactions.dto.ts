import { IsString, IsOptional, IsDateString } from 'class-validator';

export class SyncTransactionsDto {
  @IsString()
  @IsOptional()
  plaidItemId?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
