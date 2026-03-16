import { IsString, IsBoolean, IsNumber, IsOptional, IsArray, IsEnum } from 'class-validator';

export enum RuleMatchType {
  EXACT_MERCHANT = 'EXACT_MERCHANT',
  CONTAINS_TEXT = 'CONTAINS_TEXT',
  REGEX_PATTERN = 'REGEX_PATTERN',
  AMOUNT_RANGE = 'AMOUNT_RANGE',
  CATEGORY_MATCH = 'CATEGORY_MATCH',
  COMBINED = 'COMBINED',
}

export enum BankFeedRuleType {
  CREATION = 'CREATION',
  MATCHING = 'MATCHING',
}

export class CreateBankFeedRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(BankFeedRuleType)
  ruleType?: BankFeedRuleType;

  @IsEnum(RuleMatchType)
  matchType: RuleMatchType;

  @IsOptional()
  @IsString()
  merchantPattern?: string;

  @IsOptional()
  @IsString()
  descriptionPattern?: string;

  @IsOptional()
  @IsArray()
  categoryPatterns?: string[];

  @IsOptional()
  @IsNumber()
  amountMin?: number;

  @IsOptional()
  @IsNumber()
  amountMax?: number;

  // Creation rule fields
  @IsOptional()
  @IsString()
  assignToAccountId?: string;

  @IsOptional()
  @IsString()
  defaultMemo?: string;

  @IsOptional()
  @IsBoolean()
  autoPost?: boolean;

  @IsOptional()
  dimensionValues?: any;

  // Matching rule fields
  @IsOptional()
  @IsNumber()
  amountTolerance?: number;

  @IsOptional()
  @IsNumber()
  dateTolerance?: number;

  @IsOptional()
  @IsBoolean()
  matchByReference?: boolean;

  @IsOptional()
  @IsString()
  referencePattern?: string;
}

export class UpdateBankFeedRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(BankFeedRuleType)
  ruleType?: BankFeedRuleType;

  @IsOptional()
  @IsEnum(RuleMatchType)
  matchType?: RuleMatchType;

  @IsOptional()
  @IsString()
  merchantPattern?: string;

  @IsOptional()
  @IsString()
  descriptionPattern?: string;

  @IsOptional()
  @IsArray()
  categoryPatterns?: string[];

  @IsOptional()
  @IsNumber()
  amountMin?: number;

  @IsOptional()
  @IsNumber()
  amountMax?: number;

  // Creation rule fields
  @IsOptional()
  @IsString()
  assignToAccountId?: string;

  @IsOptional()
  @IsString()
  defaultMemo?: string;

  @IsOptional()
  @IsBoolean()
  autoPost?: boolean;

  @IsOptional()
  dimensionValues?: any;

  // Matching rule fields
  @IsOptional()
  @IsNumber()
  amountTolerance?: number;

  @IsOptional()
  @IsNumber()
  dateTolerance?: number;

  @IsOptional()
  @IsBoolean()
  matchByReference?: boolean;

  @IsOptional()
  @IsString()
  referencePattern?: string;
}
