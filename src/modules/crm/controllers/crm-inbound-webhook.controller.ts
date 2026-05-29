import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createLogger } from '../../../common/services/logger.service';
import { CreateContactPayloadDto, CrmInboundWebhookDto } from '../dto/crm-inbound-webhook.dto';
import { extractPhoneNumber } from '../../conversations/utils/phone';
import { CrmContactsService } from '../services/crm-contacts.service';

@ApiTags('v1/webhooks')
@Controller('v1/webhooks')
export class CrmInboundWebhookController {
  private readonly logger = createLogger('CrmInboundWebhookController');

  constructor(private readonly contactsService: CrmContactsService) {}

  @Post('crm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive CRM entity-creation callbacks',
    description: 'CRM systems POST here after creating a contact or deal requested by outbound CRM events.',
  })
  async handle(@Body() dto: CrmInboundWebhookDto): Promise<{ ok: boolean }> {
    if (dto.createContact) {
      await this.handleCreateContact(dto.createContact);
    }

    if (dto.createDeal) {
      this.logger.debug('CRM created deal', { dealId: dto.createDeal.dealId });
    }

    return { ok: true };
  }

  private async handleCreateContact(payload: CreateContactPayloadDto): Promise<void> {
    this.logger.debug('CRM created contact', {
      contactId: payload.contactId,
      chatId: payload.chatId,
    });

    const name = payload.name ?? extractPhoneNumber(payload.chatId) ?? payload.chatId;
    await this.contactsService.upsert([
      {
        id: payload.contactId,
        name,
        contactData: [{ chatType: payload.chatType, chatId: payload.chatId }],
      },
    ]);
  }
}
