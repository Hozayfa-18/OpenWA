import { IsString, IsUUID } from 'class-validator';

export class AssignConversationDto {
  @IsString()
  @IsUUID()
  userId: string;
}
