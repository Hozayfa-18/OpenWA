import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createLogger } from '../../../common/services/logger.service';
import { extractPhoneNumber } from '../../conversations/utils/phone';
import { WebhookService } from '../../webhook/webhook.service';
import { Contact, ContactChatType } from '../entities/contact.entity';

export interface InboundMessageContext {
  sessionId: string;
  tenantId: string;
  chatType: ContactChatType;
  chatId: string;
  messageId: string;
  body: string;
  timestamp: number;
}

/**
 * Bridges inbound WhatsApp messages to the tenant's CRM via a signed
 * `message.inbound` webhook (ADR-005). When no contact matches, a `createContact`
 * hint is attached so the tenant's CRM creates the lead (lead creation stays on
 * their side).
 *
 * This is a SINGLETON with tenant-explicit lookups (its own Contact repository,
 * no request-scoped TenantContext) so it can be called from the engine's
 * message callback, which runs outside any HTTP request.
 */
@Injectable()
export class CrmOutboundService {
  private readonly logger = createLogger('CrmOutboundService');

  constructor(
    private readonly webhookService: WebhookService,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
  ) {}

  private async findContact(tenantId: string, chatType: ContactChatType, chatId: string): Promise<Contact | null> {
    const contacts = await this.contactRepository.find({ where: { tenantId } });
    return (
      contacts.find(contact =>
        contact.contactData.some(entry => entry.chatType === chatType && entry.chatId === chatId),
      ) ?? null
    );
  }

  async notifyMessageInbound(ctx: InboundMessageContext): Promise<void> {
    const contact = await this.findContact(ctx.tenantId, ctx.chatType, ctx.chatId);

    const payload: Record<string, unknown> = {
      messageId: ctx.messageId,
      chatType: ctx.chatType,
      chatId: ctx.chatId,
      body: ctx.body,
      timestamp: ctx.timestamp,
      tenantId: ctx.tenantId,
      contact: contact ?? null,
    };

    if (!contact) {
      payload.createContact = {
        name: extractPhoneNumber(ctx.chatId) ?? ctx.chatId,
        contactData: [{ chatType: ctx.chatType, chatId: ctx.chatId }],
        source: 'auto',
      };
    }

    await this.webhookService.dispatch(ctx.sessionId, 'message.inbound', payload);

    this.logger.debug('CRM message.inbound event dispatched', {
      sessionId: ctx.sessionId,
      chatId: ctx.chatId,
      hasContact: Boolean(contact),
    });
  }
}
