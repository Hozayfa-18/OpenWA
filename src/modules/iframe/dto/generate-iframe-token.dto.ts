import {
  IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsBoolean, IsInt, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { IframeChatFilter, IframeActiveChat, IframeScope } from '../entities/iframe-token.entity';

export class IframeUserDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class ChatFilterDto implements IframeChatFilter {
  @IsString()
  chatType: string;

  @IsString()
  chatId: string;

  @IsOptional()
  @IsString()
  username?: string;
}

export class ActiveChatDto implements IframeActiveChat {
  @IsOptional()
  @IsString()
  channelId?: string;

  @IsString()
  chatType: string;

  @IsString()
  chatId: string;
}

export class UseEventsDto {
  @IsOptional()
  @IsBoolean()
  deals?: boolean;

  @IsOptional()
  @IsBoolean()
  messages?: boolean;
}

export class GenerateIframeTokenDto {
  @ValidateNested()
  @Type(() => IframeUserDto)
  user: IframeUserDto;

  @IsEnum(['global', 'card'])
  scope: IframeScope;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatFilterDto)
  filter?: ChatFilterDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ActiveChatDto)
  activeChat?: ActiveChatDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UseEventsDto)
  use_events?: UseEventsDto;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  ttlMinutes?: number;
}
