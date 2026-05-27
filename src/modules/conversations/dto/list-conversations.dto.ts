import { IsOptional, IsString } from 'class-validator';

export class ListConversationsDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  assignedUserId?: string;
}
