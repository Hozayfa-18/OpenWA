import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssignConversationDto } from '../dto/assign-conversation.dto';
import { LinkContactDto } from '../dto/link-contact.dto';
import { ListConversationsDto } from '../dto/list-conversations.dto';
import { Conversation } from '../entities/conversation.entity';
import { ConversationRepository } from '../repositories/conversation.repository';
import { EventsGateway } from '../../events/events.gateway';
import { Contact } from '../../crm/entities/contact.entity';
import { extractPhoneNumber } from '../utils/phone';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly repo: ConversationRepository,
    private readonly eventsGateway: EventsGateway,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
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

  async linkContact(sessionId: string, chatId: string, dto: LinkContactDto): Promise<void> {
    const conversation = await this.repo.findByChat(sessionId, chatId);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${chatId} not found`);
    }

    const contact = await this.contactRepo.findOneBy({
      id: dto.contactId,
      tenantId: conversation.tenantId,
    });
    if (!contact) {
      throw new NotFoundException(`Contact ${dto.contactId} not found`);
    }

    const waEntry = contact.contactData.find(e => e.chatType === 'whatsapp');
    const phoneNumber = waEntry ? (extractPhoneNumber(waEntry.chatId) ?? null) : null;

    await this.repo.linkContact(sessionId, chatId, contact.id, contact.name, phoneNumber);
  }

  async markRead(sessionId: string, chatId: string): Promise<void> {
    const conversation = await this.repo.findByChat(sessionId, chatId);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${chatId} not found`);
    }

    await this.repo.updateByChat(sessionId, chatId, { unreadCount: 0 });
  }
}
