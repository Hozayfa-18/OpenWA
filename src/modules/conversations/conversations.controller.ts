import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { StorageService } from '../../common/storage/storage.service';
import type { StoredMedia } from '../../common/storage/media.util';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { Message } from '../message/entities/message.entity';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { LinkContactDto } from './dto/link-contact.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { ConversationsService } from './services/conversations.service';

// Wire-shape returned to the chat UI: the persisted row minus internal media
// bookkeeping, plus mimetype/filename so the client knows to render media. The
// bytes themselves are streamed from the `/media` endpoint below.
type ChatMessageResponse = Omit<Message, 'metadata'> & {
  mediaMimetype?: string;
  mediaFilename?: string;
};

const readStoredMedia = (message: Message): StoredMedia | undefined => {
  const media = (message.metadata as { media?: StoredMedia } | null | undefined)?.media;
  return media?.key ? media : undefined;
};

const toChatMessage = (message: Message): ChatMessageResponse => {
  const { metadata: _metadata, ...rest } = message;
  const media = readStoredMedia(message);
  return media ? { ...rest, mediaMimetype: media.mimetype, mediaFilename: media.filename } : { ...rest };
};

@Controller('v1/conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly ctx: TenantContext,
    private readonly storageService: StorageService,
  ) {}

  private cardScopeChatIds(): string[] | undefined {
    const embed = this.ctx.embed;
    if (embed?.scope === 'card') {
      return (embed.filter ?? []).map((f) => f.chatId);
    }
    return undefined; // global scope or regular user → no restriction
  }

  private assertChatInScope(chatId: string): void {
    const chatIds = this.cardScopeChatIds();
    if (chatIds !== undefined && !chatIds.includes(chatId)) {
      throw new ForbiddenException('Chat is outside the embed session scope');
    }
  }

  @Get()
  list(@Query() dto: ListConversationsDto) {
    const chatIds = this.cardScopeChatIds();
    if (chatIds !== undefined && chatIds.length === 0) return Promise.resolve([]);
    return this.conversationsService.findAll(dto, chatIds);
  }

  @Get(':sessionId/:chatId/messages')
  async messages(
    @Param('sessionId') sessionId: string,
    @Param('chatId') chatId: string,
  ): Promise<ChatMessageResponse[]> {
    this.assertChatInScope(chatId);
    const messages = await this.messageRepository.find({
      where: { sessionId, chatId, tenantId: this.ctx.tenantId } as FindOptionsWhere<Message>,
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return messages.map(toChatMessage);
  }

  // Streams the bytes for a media message (voice note, image, document) through
  // the backend so the storage bucket can stay private. Auth/tenant scoping is
  // enforced here exactly like the messages list.
  @Get(':sessionId/:chatId/messages/:messageId/media')
  async media(
    @Param('sessionId') sessionId: string,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Res() res: Response,
  ): Promise<void> {
    this.assertChatInScope(chatId);
    const message = await this.messageRepository.findOne({
      where: { id: messageId, sessionId, chatId, tenantId: this.ctx.tenantId } as FindOptionsWhere<Message>,
    });
    const media = message ? readStoredMedia(message) : undefined;
    if (!media) {
      throw new NotFoundException('Message has no media');
    }

    const data = await this.storageService.getFile(media.key);
    res.setHeader('Content-Type', media.mimetype);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    if (media.filename) {
      res.setHeader('Content-Disposition', `inline; filename="${media.filename.replace(/"/g, '')}"`);
    }
    res.send(data);
  }

  @Patch(':sessionId/:chatId/assign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(ApiKeyRole.OPERATOR)
  async assign(
    @Param('sessionId') sessionId: string,
    @Param('chatId') chatId: string,
    @Body() dto: AssignConversationDto,
  ): Promise<void> {
    await this.conversationsService.assign(sessionId, chatId, dto);
  }

  @Patch(':sessionId/:chatId/contact')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(ApiKeyRole.OPERATOR)
  async linkContact(
    @Param('sessionId') sessionId: string,
    @Param('chatId') chatId: string,
    @Body() dto: LinkContactDto,
  ): Promise<void> {
    await this.conversationsService.linkContact(sessionId, chatId, dto);
  }

  @Patch(':sessionId/:chatId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(ApiKeyRole.OPERATOR)
  async markRead(@Param('sessionId') sessionId: string, @Param('chatId') chatId: string): Promise<void> {
    await this.conversationsService.markRead(sessionId, chatId);
  }
}
