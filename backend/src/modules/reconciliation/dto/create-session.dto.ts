import { IsString, IsNotEmpty, IsDateString, IsOptional, IsDecimal } from 'class-validator';

export class CreateReconSessionDto {
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @IsString()
  @IsNotEmpty()
  statementEndingBalance: string;

  @IsDateString()
  @IsNotEmpty()
  statementEndDate: string;

  @IsString()
  @IsOptional()
  statementBeginningBalance?: string; // Optional - will default to prior session's ending balance
}
