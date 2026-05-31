import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service';
import { UpsertDealItemDto } from '../dto/upsert-deals.dto';
import { Deal } from '../entities/deal.entity';
import { CrmUser } from '../entities/crm-user.entity';
import { CrmContactsService } from './crm-contacts.service';

export interface ChatDealView {
  id: string;
  name: string;
  closed: boolean;
  responsibleUserName: string;
}

@Injectable()
export class CrmDealsService {
  constructor(
    @InjectRepository(Deal)
    private readonly repo: Repository<Deal>,
    private readonly ctx: TenantContext,
    private readonly contactsService: CrmContactsService,
    @InjectRepository(CrmUser)
    private readonly userRepo: Repository<CrmUser>,
  ) {}

  findAll(): Promise<Deal[]> {
    return this.repo.findBy({ tenantId: this.ctx.tenantId });
  }

  async upsert(items: UpsertDealItemDto[]): Promise<{ upserted: number }> {
    const tenantId = this.ctx.tenantId;

    if (items.length === 0) {
      return { upserted: 0 };
    }

    await this.repo.upsert(
      items.map(item => ({
        id: item.id,
        tenantId,
        name: item.name,
        responsibleUserId: item.responsibleUserId ?? null,
        contactIds: item.contactIds ?? [],
        closed: item.closed ?? false,
        uri: item.uri ?? null,
      })),
      { conflictPaths: ['tenantId', 'id'], skipUpdateIfNoValuesChanged: true },
    );

    return { upserted: items.length };
  }

  async findForChat(chatType: string, chatId: string): Promise<ChatDealView[]> {
    const contact = await this.contactsService.findByChatId(chatType, chatId);
    if (!contact) {
      return [];
    }

    const tenantId = this.ctx.tenantId;
    const deals = await this.repo.findBy({ tenantId });
    const linked = deals.filter(d => d.contactIds.includes(contact.id));

    const users = await this.userRepo.findBy({ tenantId });
    const userNames = new Map<string, string>(users.map(u => [u.id, u.name]));

    return linked.map(d => ({
      id: d.id,
      name: d.name,
      closed: d.closed,
      responsibleUserName: (d.responsibleUserId && userNames.get(d.responsibleUserId)) || '',
    }));
  }

  async createForChat(chatType: string, chatId: string, name: string): Promise<ChatDealView> {
    const contact = await this.contactsService.findByChatId(chatType, chatId);
    const id = randomUUID();

    await this.repo.save({
      id,
      tenantId: this.ctx.tenantId,
      name,
      responsibleUserId: null,
      contactIds: contact ? [contact.id] : [],
      closed: false,
      uri: null,
    });

    return { id, name, closed: false, responsibleUserName: '' };
  }
}
