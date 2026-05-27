import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service';
import { UpsertContactItemDto } from '../dto/upsert-contacts.dto';
import { Contact, ContactChatType } from '../entities/contact.entity';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { extractPhoneNumber } from '../../conversations/utils/phone';

@Injectable()
export class CrmContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly repo: Repository<Contact>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    private readonly ctx: TenantContext,
  ) {}

  findAll(): Promise<Contact[]> {
    return this.repo.findBy({ tenantId: this.ctx.tenantId });
  }

  async upsert(items: UpsertContactItemDto[]): Promise<{ upserted: number }> {
    return this.upsertForTenant(this.ctx.tenantId, items);
  }

  async upsertForTenant(tenantId: string, items: UpsertContactItemDto[]): Promise<{ upserted: number }> {
    if (items.length === 0) {
      return { upserted: 0 };
    }

    await this.repo.manager.transaction(async manager => {
      await manager.upsert(
        Contact,
        items.map(item => ({
          id: item.id,
          tenantId,
          name: item.name,
          responsibleUserId: item.responsibleUserId ?? null,
          contactData: item.contactData,
          uri: item.uri ?? null,
        })),
        { conflictPaths: ['tenantId', 'id'], skipUpdateIfNoValuesChanged: true },
      );

      // Propagate name and phone changes to all conversations linked to these contacts in parallel
      await Promise.all(
        items.map(item => {
          const waEntry = item.contactData?.find(e => e.chatType === 'whatsapp');
          const phoneNumber = waEntry ? (extractPhoneNumber(waEntry.chatId) ?? null) : null;
          return manager.update(
            Conversation,
            { tenantId, contactId: item.id },
            { contactName: item.name, ...(phoneNumber !== null ? { phoneNumber } : {}) },
          );
        }),
      );
    });

    return { upserted: items.length };
  }

  async findByChatId(chatType: string, chatId: string): Promise<Contact | null> {
    const contacts = await this.repo.find({ where: { tenantId: this.ctx.tenantId } });

    return (
      contacts.find(contact =>
        contact.contactData.some(entry => entry.chatType === chatType && entry.chatId === chatId),
      ) ?? null
    );
  }
}

export type { ContactChatType };
