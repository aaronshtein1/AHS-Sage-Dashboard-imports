import { IsArray, IsString } from 'class-validator';

export class MatchBatchDto {
  @IsArray()
  @IsString({ each: true })
  transactionIds: string[];
}
