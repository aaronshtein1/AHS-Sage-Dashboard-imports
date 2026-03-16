import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateBankMappingDto {
  @IsString()
  plaidAccountId: string;

  @IsString()
  glAccountId: string;

  @IsOptional()
  @IsBoolean()
  enableAutoPosting?: boolean;

  @IsOptional()
  @IsString()
  defaultOffsetAccountId?: string;
}

export class UpdateBankMappingDto {
  @IsOptional()
  @IsString()
  plaidAccountId?: string;

  @IsOptional()
  @IsString()
  glAccountId?: string;

  @IsOptional()
  @IsBoolean()
  enableAutoPosting?: boolean;

  @IsOptional()
  @IsString()
  defaultOffsetAccountId?: string;
}
