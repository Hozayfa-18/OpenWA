import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { ContactChatType } from '../entities/contact.entity';

export class CreateContactPayloadDto {
  @IsString()
  contactId: string;

  @IsString()
  chatType: ContactChatType;

  @IsString()
  chatId: string;
}

export class CreateDealPayloadDto {
  @IsString()
  dealId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contactIds?: string[];
}

export class CrmInboundWebhookDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateContactPayloadDto)
  createContact?: CreateContactPayloadDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDealPayloadDto)
  createDeal?: CreateDealPayloadDto;
}
