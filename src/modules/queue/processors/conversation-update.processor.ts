import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { FindOptionsWhere, Repository } from 'typeorm';
import { createLogger } from '../../../common/services/logger.service';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { extractPhoneNumber } from '../../conversations/utils/phone';
import { EventsGateway } from '../../events/events.gateway';
import { QUEUE_NAMES } from '../queue-names';

export interface ConversationUpdateJobData {
  tenantId: string;
  sessionId: string;
  chatId: string;
  messageId: string;
  messageAt: number;
  direction: 'incoming' | 'outgoing';
  from?: string;
}

@Processor(QUEUE_NAMES.CONVERSATION_UPDATE)
export class ConversationUpdateProcessor extends WorkerHost {
  private readonly logger = createLogger('ConversationUpdateProcessor');

  constructor(
    @InjectRepository(Conversation)
    private readonly repo: Repository<Conversation>,
    private readonly eventsGateway: EventsGateway,
  ) {
    super();
  }

  async process(job: Job<ConversationUpdateJobData>): Promise<void> {
    const { tenantId, sessionId, chatId, messageId, messageAt, direction, from } = job.data;
    const lastMessageAt = new Date(messageAt * 1000);
    const wasCreated = await this.createOrUpdateConversation({
      tenantId,
      sessionId,
      chatId,
      messageId,
      lastMessageAt,
      direction,
      from,
    });

    if (wasCreated) {
      this.eventsGateway.emitConversationNew(tenantId, { tenantId, sessionId, chatId });
      this.logger.debug(`New conversation created: ${chatId}`, { tenantId, sessionId, chatId });
      return;
    }

    const updated = await this.repo.findOneBy({ tenantId, sessionId, chatId } as FindOptionsWhere<Conversation>);

    this.eventsGateway.emitConversationUpdated(tenantId, {
      tenantId,
      sessionId,
      chatId,
      unreadCount: updated?.unreadCount,
    });
    this.logger.debug(`Conversation updated: ${chatId}`, { tenantId, sessionId, chatId });
  }

  private async createOrUpdateConversation(data: {
    tenantId: string;
    sessionId: string;
    chatId: string;
    messageId: string;
    lastMessageAt: Date;
    direction: 'incoming' | 'outgoing';
    from?: string;
  }): Promise<boolean> {
    const where = {
      tenantId: data.tenantId,
      sessionId: data.sessionId,
      chatId: data.chatId,
    } as FindOptionsWhere<Conversation>;

    const phoneNumber =
      extractPhoneNumber(data.chatId) ??
      (data.from ? extractPhoneNumber(data.from) : null);

    try {
      await this.repo.insert({
        tenantId: data.tenantId,
        sessionId: data.sessionId,
        chatId: data.chatId,
        contactId: null,
        assignedUserId: null,
        phoneNumber,
        contactName: null,
        lastMessageId: data.messageId,
        lastMessageAt: data.lastMessageAt,
        unreadCount: data.direction === 'incoming' ? 1 : 0,
      });
      return true;
    } catch {
      await this.repo
        .createQueryBuilder()
        .update(Conversation)
        .set({
          lastMessageId: () =>
            `CASE WHEN "lastMessageAt" <= :lastMessageAt THEN :lastMessageId ELSE "lastMessageId" END`,
          lastMessageAt: () =>
            `CASE WHEN "lastMessageAt" <= :lastMessageAt THEN :lastMessageAt ELSE "lastMessageAt" END`,
          unreadCount: () => (data.direction === 'incoming' ? '"unreadCount" + 1' : '"unreadCount"'),
        })
        .where(where)
        .setParameters({ lastMessageId: data.messageId, lastMessageAt: data.lastMessageAt })
        .execute();
      return false;
    }
  }
}
