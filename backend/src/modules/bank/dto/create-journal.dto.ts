import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateJournalFromTransactionDto {
  @IsString()
  @IsOptional()
  journalTypeCode?: string; // defaults to 'BANK'

  @IsDateString()
  @IsOptional()
  entryDate?: string; // defaults to transaction date

  @IsString()
  @IsOptional()
  description?: string; // defaults to transaction name
}
