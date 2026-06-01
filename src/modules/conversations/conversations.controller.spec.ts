import { ForbiddenException } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './services/conversations.service';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { Message } from '../message/entities/message.entity';
import { StorageService } from '../../common/storage/storage.service';
import { Repository } from 'typeorm';

describe('ConversationsController embed scope', () => {
  const makeController = (embed: unknown) => {
    const service = { findAll: jest.fn().mockResolvedValue([]) } as unknown as ConversationsService;
    const msgRepo = { find: jest.fn().mockResolvedValue([]) } as unknown as Repository<Message>;
    const ctx = { tenantId: 'tenant-a', embed } as unknown as TenantContext;
    const storage = { getFile: jest.fn() } as unknown as StorageService;
    return { controller: new ConversationsController(service, msgRepo, ctx, storage), service, msgRepo };
  };

  it('global scope (no embed): list passes undefined chatIds', async () => {
    const { controller, service } = makeController(undefined);
    await controller.list({});
    expect(service.findAll).toHaveBeenCalledWith({}, undefined);
  });

  it('card scope: list restricts to filter chatIds', async () => {
    const embed = { scope: 'card', filter: [{ chatType: 'whatsapp', chatId: '111' }, { chatType: 'whatsapp', chatId: '222' }] };
    const { controller, service } = makeController(embed);
    await controller.list({});
    expect(service.findAll).toHaveBeenCalledWith({}, ['111', '222']);
  });

  it('card scope with empty filter: list returns [] without hitting service', async () => {
    const { controller, service } = makeController({ scope: 'card', filter: [] });
    const result = await controller.list({});
    expect(result).toEqual([]);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('card scope: messages for allowed chatId returns messages', async () => {
    const embed = { scope: 'card', filter: [{ chatType: 'whatsapp', chatId: '111' }] };
    const { controller, msgRepo } = makeController(embed);
    await controller.messages('sess', '111');
    expect(msgRepo.find).toHaveBeenCalled();
  });

  it('card scope: messages for disallowed chatId throws Forbidden', async () => {
    const embed = { scope: 'card', filter: [{ chatType: 'whatsapp', chatId: '111' }] };
    const { controller } = makeController(embed);
    await expect(controller.messages('sess', '999')).rejects.toThrow(ForbiddenException);
  });
});
