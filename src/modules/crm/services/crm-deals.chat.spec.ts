import { Repository } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service';
import { Contact } from '../entities/contact.entity';
import { CrmUser } from '../entities/crm-user.entity';
import { Deal } from '../entities/deal.entity';
import { CrmContactsService } from './crm-contacts.service';
import { CrmDealsService } from './crm-deals.service';

const TENANT_ID = 'tenant-1';

const makeCtx = (): TenantContext => ({ tenantId: TENANT_ID } as unknown as TenantContext);

describe('CrmDealsService.findForChat', () => {
  it('returns [] when no contact matches the chat', async () => {
    const dealRepo = { findBy: jest.fn() } as unknown as Repository<Deal>;
    const userRepo = { findBy: jest.fn() } as unknown as Repository<CrmUser>;
    const contactsService = {
      findByChatId: jest.fn().mockResolvedValue(null),
    } as unknown as CrmContactsService;

    const service = new CrmDealsService(dealRepo, makeCtx(), contactsService, userRepo);

    const result = await service.findForChat('whatsapp', '491234567890@c.us');

    expect(result).toEqual([]);
    expect(dealRepo.findBy).not.toHaveBeenCalled();
  });

  it('returns only deals linked to the contact with resolved responsible user name', async () => {
    const contact = { id: 'contact-1' } as Contact;
    const deals: Deal[] = [
      {
        id: 'deal-linked',
        tenantId: TENANT_ID,
        name: 'Linked Deal',
        responsibleUserId: 'user-1',
        contactIds: ['contact-1'],
        closed: false,
        uri: null,
      } as Deal,
      {
        id: 'deal-other',
        tenantId: TENANT_ID,
        name: 'Other Deal',
        responsibleUserId: null,
        contactIds: ['contact-2'],
        closed: true,
        uri: null,
      } as Deal,
    ];
    const users: CrmUser[] = [{ id: 'user-1', tenantId: TENANT_ID, name: 'Alice' } as CrmUser];

    const dealRepo = { findBy: jest.fn().mockResolvedValue(deals) } as unknown as Repository<Deal>;
    const userRepo = { findBy: jest.fn().mockResolvedValue(users) } as unknown as Repository<CrmUser>;
    const contactsService = {
      findByChatId: jest.fn().mockResolvedValue(contact),
    } as unknown as CrmContactsService;

    const service = new CrmDealsService(dealRepo, makeCtx(), contactsService, userRepo);

    const result = await service.findForChat('whatsapp', '491234567890@c.us');

    expect(result).toEqual([
      { id: 'deal-linked', name: 'Linked Deal', closed: false, responsibleUserName: 'Alice' },
    ]);
  });
});
