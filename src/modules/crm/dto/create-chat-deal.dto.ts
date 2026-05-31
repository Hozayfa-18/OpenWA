import { IsString, MaxLength } from 'class-validator';

export class CreateChatDealDto {
  @IsString()
  chatType: string;

  @IsString()
  chatId: string;

  @IsString()
  @MaxLength(255)
  name: string;
}
