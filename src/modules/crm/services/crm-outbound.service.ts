import { Injectable } from '@nestjs/common';
import { createLogger } from '../../../common/services/logger.service';
import { extractPhoneNumber } from '../../conversations/utils/phone';
import { WebhookService } from '../../webhook/webhook.service';
import { CrmContactsService } from './crm-contacts.service';

export interface InboundMessageContext {
  sessionId: string;
  tenantId: string;
  chatType: string;
  chatId: string;
  messageId: string;
  body: string;
  timestamp: number;
}

@Injectable()
export class CrmOutboundService {
  private readonly logger = createLogger('CrmOutboundService');

  constructor(
    private readonly webhookService: WebhookService,
    private readonly contactsService: CrmContactsService,
  ) {}

  async notifyMessageInbound(ctx: InboundMessageContext): Promise<void> {
    const contact = await this.contactsService.findByChatId(ctx.chatType, ctx.chatId);

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
