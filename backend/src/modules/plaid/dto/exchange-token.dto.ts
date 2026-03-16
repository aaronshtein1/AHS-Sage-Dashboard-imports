import { IsString, IsNotEmpty } from 'class-validator';

export class ExchangeTokenDto {
  @IsString()
  @IsNotEmpty()
  publicToken: string;
}
