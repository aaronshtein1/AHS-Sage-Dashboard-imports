import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DimensionAssignment {
  @IsString()
  @IsNotEmpty()
  dimensionTypeId: string;

  @IsString()
  @IsNotEmpty()
  dimensionValueId: string;
}

export class CategorizeTransactionDto {
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @IsString()
  @IsOptional()
  memo?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DimensionAssignment)
  dimensions?: DimensionAssignment[];
}
