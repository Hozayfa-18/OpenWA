import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ClerkWebhookController } from './clerk-webhook.controller';

const verify = jest.fn();
jest.mock('svix', () => ({ Webhook: jest.fn().mockImplementation(() => ({ verify })) }));

const cfg = { get: () => 'whsec_test' };
const provisioning = {
  upsertTenant: jest.fn().mockResolvedValue({ id: 'tenant_1' }),
  upsertUser: jest.fn(),
  deleteMembership: jest.fn(),
};

const req = { rawBody: Buffer.from('{}'), body: {} } as unknown as RawBodyRequest<Request>;
const headers = { 'svix-id': 'a', 'svix-timestamp': 'b', 'svix-signature': 'c' };

describe('ClerkWebhookController', () => {
  beforeEach(() => {
    verify.mockReset();
    provisioning.upsertTenant.mockReset().mockResolvedValue({ id: 'tenant_1' });
    provisioning.upsertUser.mockReset();
    provisioning.deleteMembership.mockReset();
  });

  it('handles organization.created', async () => {
    verify.mockReturnValue({ type: 'organization.created', data: { id: 'org_1', name: 'Acme', slug: 'acme' } });
    const ctrl = new ClerkWebhookController(cfg as never, provisioning as never);
    await ctrl.handle(req, headers);
    expect(provisioning.upsertTenant).toHaveBeenCalledWith(
      expect.objectContaining({ clerkOrgId: 'org_1', name: 'Acme' }),
    );
  });

  it('handles organizationMembership.created', async () => {
    verify.mockReturnValue({
      type: 'organizationMembership.created',
      data: {
        role: 'org:manager',
        organization: { id: 'org_1', name: 'Acme' },
        public_user_data: { user_id: 'user_1', identifier: 'a@b.c', first_name: 'A', last_name: 'B' },
      },
    });
    const ctrl = new ClerkWebhookController(cfg as never, provisioning as never);
    await ctrl.handle(req, headers);
    expect(provisioning.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ clerkUserId: 'user_1', tenantId: 'tenant_1', role: 'manager', name: 'A B' }),
    );
  });

  it('handles organizationMembership.deleted', async () => {
    verify.mockReturnValue({
      type: 'organizationMembership.deleted',
      data: { public_user_data: { user_id: 'user_1' } },
    });
    const ctrl = new ClerkWebhookController(cfg as never, provisioning as never);
    await ctrl.handle(req, headers);
    expect(provisioning.deleteMembership).toHaveBeenCalledWith('user_1');
  });

  it('rejects an invalid signature', async () => {
    verify.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const ctrl = new ClerkWebhookController(cfg as never, provisioning as never);
    await expect(ctrl.handle(req, headers)).rejects.toThrow('Invalid signature');
  });
});
