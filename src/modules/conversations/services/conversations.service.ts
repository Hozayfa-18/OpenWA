import { Injectable, NotFoundException } from '@nestjs/common';
import { AssignConversationDto } from '../dto/assign-conversation.dto';
import { ListConversationsDto } from '../dto/list-conversations.dto';
import { Conversation } from '../entities/conversation.entity';
import { ConversationRepository } from '../repositories/conversation.repository';
import { EventsGateway } from '../../events/events.gateway';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly repo: ConversationRepository,
    private readonly eventsGateway: EventsGateway,
  ) {}

  findAll(dto: ListConversationsDto): Promise<Conversation[]> {
    return this.repo.findAll(dto);
  }

  async assign(sessionId: string, chatId: string, dto: AssignConversationDto): Promise<void> {
    const conversation = await this.repo.findByChat(sessionId, chatId);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${chatId} not found`);
    }

    await this.repo.updateByChat(sessionId, chatId, { assignedUserId: dto.userId });
    this.eventsGateway.emitConversationAssigned(conversation.tenantId, {
      tenantId: conversation.tenantId,
      sessionId: conversation.sessionId,
      chatId,
      assignedUserId: dto.userId,
    });
  }

  async markRead(sessionId: string, chatId: string): Promise<void> {
    const conversation = await this.repo.findByChat(sessionId, chatId);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${chatId} not found`);
    }

    await this.repo.updateByChat(sessionId, chatId, { unreadCount: 0 });
  }
}
