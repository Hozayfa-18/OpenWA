import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CrmOutboundService, InboundMessageContext } from './crm-outbound.service';
import { WebhookService } from '../../webhook/webhook.service';
import { Contact } from '../entities/contact.entity';

const baseCtx: InboundMessageContext = {
  sessionId: 'sess-1',
  tenantId: 'tenant-a',
  chatType: 'whatsapp',
  chatId: '49123@c.us',
  messageId: 'wamid-1',
  body: 'hello',
  timestamp: 1_700_000_000,
};

describe('CrmOutboundService', () => {
  let service: CrmOutboundService;
  let webhook: { dispatch: jest.Mock };
  let contactRepo: { find: jest.Mock };

  beforeEach(async () => {
    webhook = { dispatch: jest.fn().mockResolvedValue(undefined) };
    contactRepo = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrmOutboundService,
        { provide: WebhookService, useValue: webhook },
        { provide: getRepositoryToken(Contact), useValue: contactRepo },
      ],
    }).compile();

    service = module.get(CrmOutboundService);
  });

  it('attaches a createContact hint when no contact matches', async () => {
    contactRepo.find.mockResolvedValue([]);

    await service.notifyMessageInbound(baseCtx);

    expect(webhook.dispatch).toHaveBeenCalledWith(
      'sess-1',
      'message.inbound',
      expect.objectContaining({
        chatId: '49123@c.us',
        contact: null,
        createContact: expect.objectContaining({
          contactData: [{ chatType: 'whatsapp', chatId: '49123@c.us' }],
          source: 'auto',
        }),
      }),
    );
  });

  it('omits createContact and includes the matched contact', async () => {
    const contact = {
      id: 'c1',
      tenantId: 'tenant-a',
      name: 'Alice',
      contactData: [{ chatType: 'whatsapp', chatId: '49123@c.us' }],
    };
    contactRepo.find.mockResolvedValue([contact]);

    await service.notifyMessageInbound(baseCtx);

    const payload = webhook.dispatch.mock.calls[0][2];
    expect(payload.contact).toEqual(contact);
    expect(payload.createContact).toBeUndefined();
  });

  it('scopes the contact lookup to the message tenant', async () => {
    contactRepo.find.mockResolvedValue([]);
    await service.notifyMessageInbound(baseCtx);
    expect(contactRepo.find).toHaveBeenCalledWith({ where: { tenantId: 'tenant-a' } });
  });
});
