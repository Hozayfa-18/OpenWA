import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtAuthService } from './jwt-auth.service';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import * as bcrypt from 'bcrypt';

const mockTenant: Tenant = {
  id: 'tenant-uuid',
  name: 'Acme Corp',
  slug: 'acme-corp',
  plan: 'free',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUser: User = {
  id: 'user-uuid',
  tenantId: 'tenant-uuid',
  email: 'admin@acme.com',
  passwordHash: '',  // set per test
  name: 'Admin',
  role: UserRole.OWNER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('JwtAuthService', () => {
  let service: JwtAuthService;
  let tenantRepo: jest.Mocked<{ findOne: jest.Mock; save: jest.Mock; create: jest.Mock }>;
  let userRepo: jest.Mocked<{ findOne: jest.Mock; save: jest.Mock; create: jest.Mock }>;
  let refreshRepo: jest.Mocked<{ findOne: jest.Mock; save: jest.Mock; create: jest.Mock; delete: jest.Mock }>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;

  beforeEach(async () => {
    tenantRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
    userRepo   = { findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
    refreshRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), delete: jest.fn() };
    jwtService  = { signAsync: jest.fn(), verifyAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthService,
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepo },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<JwtAuthService>(JwtAuthService);
  });

  describe('register', () => {
    it('should create a tenant + owner user and return tokens', async () => {
      tenantRepo.findOne.mockResolvedValue(null);
      tenantRepo.create.mockReturnValue(mockTenant);
      tenantRepo.save.mockResolvedValue(mockTenant);

      const savedUser = { ...mockUser, passwordHash: 'hash' };
      userRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue(savedUser);
      userRepo.save.mockResolvedValue(savedUser);

      refreshRepo.create.mockReturnValue({ id: 'rt-uuid' } as RefreshToken);
      refreshRepo.save.mockResolvedValue({ id: 'rt-uuid' } as RefreshToken);

      jwtService.signAsync.mockResolvedValue('access-token');

      const result = await service.register({
        tenantName: 'Acme Corp',
        email: 'admin@acme.com',
        password: 'password123',
        name: 'Admin',
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBeDefined();
      expect(tenantRepo.save).toHaveBeenCalled();
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists in tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(null);
      tenantRepo.create.mockReturnValue(mockTenant);
      tenantRepo.save.mockResolvedValue(mockTenant);
      userRepo.findOne.mockResolvedValue(mockUser); // already exists

      await expect(
        service.register({
          tenantName: 'Acme Corp',
          email: 'admin@acme.com',
          password: 'password123',
          name: 'Admin',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 1);
      userRepo.findOne.mockResolvedValue({ ...mockUser, passwordHash: hash });

      refreshRepo.create.mockReturnValue({ id: 'rt-uuid' } as RefreshToken);
      refreshRepo.save.mockResolvedValue({ id: 'rt-uuid' } as RefreshToken);
      jwtService.signAsync.mockResolvedValue('access-token');

      const result = await service.login({
        email: 'admin@acme.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('access-token');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('correct', 1);
      userRepo.findOne.mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(
        service.login({ email: 'admin@acme.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for unknown email', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@acme.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
