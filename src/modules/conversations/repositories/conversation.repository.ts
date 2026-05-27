import { Injectable, Scope } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service';
import { Conversation } from '../entities/conversation.entity';

@Injectable({ scope: Scope.REQUEST })
export class ConversationRepository {
  constructor(
    @InjectRepository(Conversation)
    private readonly repo: Repository<Conversation>,
    private readonly ctx: TenantContext,
  ) {}

  private get tenantId(): string {
    return this.ctx.tenantId;
  }

  findAll(filters: { sessionId?: string; assignedUserId?: string } = {}): Promise<Conversation[]> {
    return this.repo.find({
      where: {
        tenantId: this.tenantId,
        ...(filters.sessionId ? { sessionId: filters.sessionId } : {}),
        ...(filters.assignedUserId ? { assignedUserId: filters.assignedUserId } : {}),
      } as FindOptionsWhere<Conversation>,
      order: { lastMessageAt: 'DESC' },
    });
  }

  findByChat(sessionId: string, chatId: string): Promise<Conversation | null> {
    return this.repo.findOneBy({
      tenantId: this.tenantId,
      sessionId,
      chatId,
    } as FindOptionsWhere<Conversation>);
  }

  async updateByChat(sessionId: string, chatId: string, updates: Partial<Conversation>): Promise<void> {
    await this.repo.update(
      { tenantId: this.tenantId, sessionId, chatId } as FindOptionsWhere<Conversation>,
      updates,
    );
  }
}
