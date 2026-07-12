import { ClerkProvisioningService } from './clerk-provisioning.service';
import { UserRole } from '../../users/entities/user.entity';

const makeRepo = <T extends { id?: string }>() => {
  const rows: T[] = [];
  return {
    rows,
    findOne: jest.fn(async ({ where }: { where: Partial<T> }) =>
      rows.find(r => Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v)) ?? null),
    create: jest.fn((d: Partial<T>) => ({ ...d } as T)),
    save: jest.fn(async (d: T) => {
      const e = { ...d, id: (d as { id?: string }).id ?? `id_${rows.length + 1}` } as T;
      rows.push(e);
      return e;
    }),
    delete: jest.fn(async () => undefined),
  };
};

const makeClerkApi = (
  user: { email: string; name: string } | null = { email: 'api@b.c', name: 'Api User' },
  org: { name: string; slug?: string } | null = { name: 'Acme', slug: 'acme' },
) => ({
  getUser: jest.fn().mockResolvedValue(user),
  getOrganization: jest.fn().mockResolvedValue(org),
});

describe('ClerkProvisioningService', () => {
  it('JIT-creates tenant + user, using token email when present', async () => {
    const tenantRepo = makeRepo();
    const userRepo = makeRepo();
    const clerkApi = makeClerkApi();
    const svc = new ClerkProvisioningService(tenantRepo as never, userRepo as never, clerkApi as never);

    const res = await svc.resolveFromClaims({
      userId: 'user_1',
      orgId: 'org_1',
      orgRole: 'org:admin',
      email: 'a@b.c',
      name: 'A',
    });

    expect(res).toEqual(expect.objectContaining({ role: UserRole.ADMIN }));
    expect(tenantRepo.rows).toHaveLength(1);
    expect(userRepo.rows).toHaveLength(1);
    expect((userRepo.rows[0] as { email: string }).email).toBe('a@b.c');
    // Token carried the email, so no Clerk API user lookup was needed.
    expect(clerkApi.getUser).not.toHaveBeenCalled();
    // Org name is never in the token, so it is always fetched.
    expect((tenantRepo.rows[0] as { name: string }).name).toBe('Acme');
  });

  it('falls back to the Clerk API for email when the token has none', async () => {
    const tenantRepo = makeRepo();
    const userRepo = makeRepo();
    const clerkApi = makeClerkApi();
    const svc = new ClerkProvisioningService(tenantRepo as never, userRepo as never, clerkApi as never);

    await svc.resolveFromClaims({ userId: 'user_1', orgId: 'org_1', orgRole: 'org:admin' });

    expect(clerkApi.getUser).toHaveBeenCalledWith('user_1');
    expect((userRepo.rows[0] as { email: string }).email).toBe('api@b.c');
  });

  it('returns null when no orgId', async () => {
    const svc = new ClerkProvisioningService(makeRepo() as never, makeRepo() as never, makeClerkApi() as never);
    await expect(svc.resolveFromClaims({ userId: 'u' })).resolves.toBeNull();
  });

  it('deleteMembership calls repo.delete', async () => {
    const userRepo = makeRepo();
    const svc = new ClerkProvisioningService(makeRepo() as never, userRepo as never, makeClerkApi() as never);
    await svc.deleteMembership('user_1');
    expect(userRepo.delete).toHaveBeenCalledWith({ clerkUserId: 'user_1' });
  });
});
