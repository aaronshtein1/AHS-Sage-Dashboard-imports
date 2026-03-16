import { IsString, IsArray, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum MatchType {
  SOURCE_TO_JOURNAL = 'source_to_journal',
  JOURNAL_TO_JOURNAL = 'journal_to_journal',
  SOURCE_TO_SOURCE = 'source_to_source',
}

export class CreateMatchDto {
  @IsEnum(MatchType)
  @IsNotEmpty()
  matchType: MatchType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sourceTransactionIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  journalLineIds?: string[];
}
