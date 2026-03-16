import { IsString, IsNotEmpty } from 'class-validator';

export class CreateLinkTokenDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
