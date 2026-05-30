import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { Message } from '../message/entities/message.entity';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { LinkContactDto } from './dto/link-contact.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { ConversationsService } from './services/conversations.service';

@Controller('v1/conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly ctx: TenantContext,
  ) {}

  private cardScopeChatIds(): string[] | undefined {
    const embed = this.ctx.embed;
    if (embed?.scope === 'card') {
      return (embed.filter ?? []).map((f) => f.chatId);
    }
    return undefined; // global scope or regular user → no restriction
  }

  @Get()
  list(@Query() dto: ListConversationsDto) {
    const chatIds = this.cardScopeChatIds();
    if (chatIds !== undefined && chatIds.length === 0) return Promise.resolve([]);
    return this.conversationsService.findAll(dto, chatIds);
  }

  @Get(':sessionId/:chatId/messages')
  messages(@Param('sessionId') sessionId: string, @Param('chatId') chatId: string): Promise<Message[]> {
    const chatIds = this.cardScopeChatIds();
    if (chatIds !== undefined && !chatIds.includes(chatId)) {
      throw new ForbiddenException('Chat is outside the embed session scope');
    }
    return this.messageRepository.find({
      where: { sessionId, chatId, tenantId: this.ctx.tenantId } as FindOptionsWhere<Message>,
      order: { createdAt: 'DESC' },
      take: 100,
    });
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
