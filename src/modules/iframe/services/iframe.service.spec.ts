import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { IframeService } from './iframe.service';
import { IframeToken } from '../entities/iframe-token.entity';
import { TenantContext } from '../../../common/tenant/tenant-context.service';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

const mockRepo = () => ({
  save: jest.fn(),
  findOneBy: jest.fn(),
  delete: jest.fn(),
});

describe('IframeService', () => {
  let service: IframeService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IframeService,
        { provide: getRepositoryToken(IframeToken), useFactory: mockRepo },
        { provide: TenantContext, useValue: { tenantId: 'tenant-a' } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://localhost:5173') } },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('embed-jwt-token') } },
      ],
    }).compile();

    service = await module.resolve(IframeService);
    repo = module.get(getRepositoryToken(IframeToken));
  });

  describe('generate', () => {
    it('returns a URL pointing to the embed page', async () => {
      repo.save.mockResolvedValue({ id: 'tok-uuid', expiresAt: new Date(Date.now() + 3600_000) });
      const result = await service.generate({ user: { id: 'u1' }, scope: 'global' });
      expect(result.url).toContain('/embed/chat?token=tok-uuid');
    });

    it('includes use_events flags in the stored token', async () => {
      repo.save.mockImplementation((t: Partial<IframeToken>) => Promise.resolve({ ...t, id: 'tok' }));
      await service.generate({ user: { id: 'u1' }, scope: 'card', use_events: { deals: true } });
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ useDealsEvents: true }));
    });
  });

  describe('exchange', () => {
    it('returns an embed JWT when token is valid', async () => {
      const future = new Date(Date.now() + 60_000);
      repo.findOneBy.mockResolvedValue({
        id: 'tok', tenantId: 'tenant-a', crmUserId: 'u1', scope: 'global',
        filter: null, activeChat: null, useDealsEvents: false, useMessageEvents: false, expiresAt: future,
      });
      const result = await service.exchange('tok');
      expect(result.accessToken).toBe('embed-jwt-token');
    });

    it('throws NotFoundException for unknown token', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.exchange('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws UnauthorizedException for expired token', async () => {
      repo.findOneBy.mockResolvedValue({ id: 'tok', expiresAt: new Date(Date.now() - 1000) });
      await expect(service.exchange('tok')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
