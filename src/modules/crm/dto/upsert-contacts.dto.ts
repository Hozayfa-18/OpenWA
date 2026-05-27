import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { ContactChatType } from '../entities/contact.entity';

const CONTACT_CHAT_TYPES: ContactChatType[] = ['whatsapp', 'telegram', 'instagram', 'viber', 'vk', 'avito'];

export class ContactDataEntryDto {
  @IsEnum(CONTACT_CHAT_TYPES)
  chatType: ContactChatType;

  @IsString()
  chatId: string;

  @IsOptional()
  @IsString()
  username?: string;
}

export class UpsertContactItemDto {
  @IsString()
  @MaxLength(36)
  id: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  responsibleUserId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactDataEntryDto)
  contactData: ContactDataEntryDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  uri?: string;
}

export class UpsertContactsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UpsertContactItemDto)
  contacts: UpsertContactItemDto[];
}
