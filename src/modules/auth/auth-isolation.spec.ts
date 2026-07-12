import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/entities/user.entity';
import { TenantContext } from '../../common/tenant/tenant-context.service';

/**
 * Tenant isolation proof:
 * - Tenant A creates a user
 * - A TenantContext scoped to Tenant B cannot see or delete Tenant A's user
 */

const TENANT_A = 'tenant-a-uuid';
const TENANT_B = 'tenant-b-uuid';

const userInA: User = {
  id: 'user-in-a',
  tenantId: TENANT_A,
  email: 'alice@a.com',
  passwordHash: 'hash',
  clerkUserId: null,
  name: 'Alice',
  role: UserRole.SALES_REP,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Tenant isolation — UsersService', () => {
  let serviceA: UsersService;
  let serviceB: UsersService;
  let repo: jest.Mocked<{
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
  }>;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const ctxA = { tenantId: TENANT_A };
    const ctxB = { tenantId: TENANT_B };

    const buildModule = async (ctx: { tenantId: string }) => {
      const m: TestingModule = await Test.createTestingModule({
        providers: [
          UsersService,
          { provide: getRepositoryToken(User), useValue: repo },
          { provide: TenantContext, useValue: ctx },
        ],
      }).compile();
      return m.get<UsersService>(UsersService);
    };

    serviceA = await buildModule(ctxA);
    serviceB = await buildModule(ctxB);
  });

  it('findAll for Tenant B queries with tenantId = TENANT_B, not TENANT_A', async () => {
    repo.find.mockResolvedValue([]);

    await serviceB.findAll();

    expect(repo.find).toHaveBeenCalledWith({ where: { tenantId: TENANT_B } });
    expect(repo.find).not.toHaveBeenCalledWith({ where: { tenantId: TENANT_A } });
  });

  it('Tenant B cannot find Tenant A user by id', async () => {
    // repo returns null when queried with { id: 'user-in-a', tenantId: TENANT_B }
    repo.findOne.mockResolvedValue(null);

    await expect(serviceB.update('user-in-a', { name: 'Hacked' })).rejects.toThrow();

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'user-in-a', tenantId: TENANT_B },
    });
  });

  it('Tenant B cannot delete Tenant A user', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(serviceB.delete('user-in-a')).rejects.toThrow();

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'user-in-a', tenantId: TENANT_B },
    });
    // remove was never called because findOne returned null
    expect(repo.remove).not.toHaveBeenCalled();
  });
});

// Suppress unused-variable warning — userInA documents the fixture intent
void userInA;
