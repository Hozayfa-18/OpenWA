import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service';
import { UpsertContactItemDto } from '../dto/upsert-contacts.dto';
import { Contact, ContactChatType } from '../entities/contact.entity';

@Injectable()
export class CrmContactsService {
  constructor(
    @InjectRepository(Contact, 'data')
    private readonly repo: Repository<Contact>,
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

    await this.repo.upsert(
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

    return { upserted: items.length };
  }

  async findByChatId(chatType: string, chatId: string): Promise<Contact | null> {
    const contacts = await this.repo.find({ where: { tenantId: this.ctx.tenantId } });

    return contacts.find(contact =>
      contact.contactData.some(entry => entry.chatType === chatType && entry.chatId === chatId),
    ) ?? null;
  }

}

export type { ContactChatType };
