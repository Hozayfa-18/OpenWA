import { IsString, IsUUID } from 'class-validator';

export class LinkContactDto {
  @IsString()
  @IsUUID()
  contactId: string;
}
