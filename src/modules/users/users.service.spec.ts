import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';
import { TenantContext } from '../../common/tenant/tenant-context.service';

const TENANT_ID = 'tenant-abc';

const mockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  tenantId: TENANT_ID,
  email: 'alice@acme.com',
  passwordHash: 'hash',
  name: 'Alice',
  role: UserRole.SALES_REP,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<{ find: jest.Mock; findOne: jest.Mock; save: jest.Mock; create: jest.Mock; remove: jest.Mock }>;
  let ctx: jest.Mocked<Pick<TenantContext, 'tenantId'>>;

  beforeEach(async () => {
    repo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn(), remove: jest.fn() };
    ctx  = { tenantId: TENANT_ID };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User, 'data'), useValue: repo },
        { provide: TenantContext, useValue: ctx },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('returns users for the current tenant only', async () => {
      const users = [mockUser()];
      repo.find.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(repo.find).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } });
    });
  });

  describe('create', () => {
    it('creates a user when email is available', async () => {
      repo.findOne.mockResolvedValue(null);
      const newUser = mockUser({ id: 'new-user' });
      repo.create.mockReturnValue(newUser);
      repo.save.mockResolvedValue(newUser);

      const result = await service.create({
        email: 'alice@acme.com',
        password: 'password123',
        name: 'Alice',
        role: UserRole.SALES_REP,
      });

      expect(result.id).toBe('new-user');
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws ConflictException when email is already taken in tenant', async () => {
      repo.findOne.mockResolvedValue(mockUser());

      await expect(
        service.create({ email: 'alice@acme.com', password: 'pw', name: 'Alice', role: UserRole.SALES_REP }),
      ).rejects.toThrow(ConflictException);
    });

    it('prevents creating a second owner', async () => {
      repo.findOne
        .mockResolvedValueOnce(null)                       // email check
        .mockResolvedValueOnce(mockUser({ role: UserRole.OWNER }));  // owner check

      await expect(
        service.create({ email: 'other@acme.com', password: 'pw', name: 'Other', role: UserRole.OWNER }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('updates name and role', async () => {
      const user = mockUser();
      repo.findOne.mockResolvedValue(user);
      repo.save.mockImplementation(u => Promise.resolve(u as User));

      const result = await service.update('user-1', { name: 'Alice Updated', role: UserRole.MANAGER });

      expect(result.name).toBe('Alice Updated');
      expect(result.role).toBe(UserRole.MANAGER);
    });

    it('throws NotFoundException for unknown user', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('unknown', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('removes a user in the tenant', async () => {
      const user = mockUser();
      repo.findOne.mockResolvedValue(user);
      repo.remove.mockResolvedValue(user);

      await service.delete('user-1');

      expect(repo.remove).toHaveBeenCalledWith(user);
    });

    it('prevents deleting the owner', async () => {
      repo.findOne.mockResolvedValue(mockUser({ role: UserRole.OWNER }));

      await expect(service.delete('user-1')).rejects.toThrow(ForbiddenException);
    });
  });
});
