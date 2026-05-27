import { IsNotEmpty, IsUUID } from 'class-validator';

export class LinkContactDto {
  @IsNotEmpty()
  @IsUUID()
  contactId: string;
}
