import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantScopeGuard } from './tenant-scope.guard';
import { Session } from '../../modules/session/entities/session.entity';
import type { RequestWithTenant } from './request-with-tenant.interface';

const TENANT_A = 'tenant-a-uuid';
const TENANT_B = 'tenant-b-uuid';

const buildContext = (req: Partial<RequestWithTenant>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req as RequestWithTenant }),
  }) as unknown as ExecutionContext;

describe('TenantScopeGuard', () => {
  let guard: TenantScopeGuard;
  let repo: { findOne: jest.Mock };

  beforeEach(() => {
    repo = { findOne: jest.fn() };
    guard = new TenantScopeGuard(repo as unknown as Repository<Session>);
  });

  it('passes routes without a session id (list/stats) to the service layer', async () => {
    const ctx = buildContext({ params: {}, tenantId: TENANT_A });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('allows access to a session owned by the tenant', async () => {
    repo.findOne.mockResolvedValue({ id: 'sess-a', tenantId: TENANT_A });
    const ctx = buildContext({ params: { id: 'sess-a' }, tenantId: TENANT_A });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('returns 404 (not 403) for a session owned by another tenant', async () => {
    repo.findOne.mockResolvedValue({ id: 'sess-a', tenantId: TENANT_A });
    const ctx = buildContext({ params: { sessionId: 'sess-a' }, tenantId: TENANT_B });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 for a non-existent session (no existence oracle)', async () => {
    repo.findOne.mockResolvedValue(null);
    const ctx = buildContext({ params: { sessionId: 'ghost' }, tenantId: TENANT_A });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses when tenant context is missing', async () => {
    const ctx = buildContext({ params: { id: 'sess-a' } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('prefers :sessionId over :id when both are present', async () => {
    repo.findOne.mockResolvedValue({ id: 'sess-x', tenantId: TENANT_A });
    const ctx = buildContext({ params: { sessionId: 'sess-x', id: 'webhook-1' }, tenantId: TENANT_A });
    await guard.canActivate(ctx);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'sess-x' },
      select: ['id', 'tenantId'],
    });
  });
});
