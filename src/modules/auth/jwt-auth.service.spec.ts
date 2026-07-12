import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthService } from './jwt-auth.service';
import { User, UserRole } from '../users/entities/user.entity';

const mockUser: User = {
  id: 'user-uuid',
  tenantId: 'tenant-uuid',
  email: 'admin@acme.com',
  passwordHash: null,
  clerkUserId: 'clerk_user_1',
  name: 'Admin',
  role: UserRole.OWNER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('JwtAuthService', () => {
  let service: JwtAuthService;
  let userRepo: jest.Mocked<{ findOne: jest.Mock }>;

  beforeEach(async () => {
    userRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthService, { provide: getRepositoryToken(User), useValue: userRepo }],
    }).compile();

    service = module.get<JwtAuthService>(JwtAuthService);
  });

  describe('me', () => {
    it('returns the user for a known id', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      await expect(service.me('user-uuid')).resolves.toEqual(mockUser);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-uuid' } });
    });

    it('throws UnauthorizedException for unknown id', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.me('nope')).rejects.toThrow(UnauthorizedException);
    });
  });
});
