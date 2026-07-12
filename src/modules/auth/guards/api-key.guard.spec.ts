import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ApiKeyGuard } from './api-key.guard';
import { AuthService } from '../auth.service';
import { ApiKey, ApiKeyRole } from '../entities/api-key.entity';
import { ClerkTokenService } from '../clerk/clerk-token.service';
import { ClerkProvisioningService } from '../clerk/clerk-provisioning.service';

function createMockApiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 'uuid-1',
    name: 'Test Key',
    keyHash: 'hash',
    keyPrefix: 'owa_k1_xxxx',
    keyCiphertext: null,
    keyIv: null,
    keyAuthTag: null,
    keyEncVersion: null,
    rotatedFrom: null,
    rotatedAt: null,
    gracePeriodEndsAt: null,
    role: ApiKeyRole.OPERATOR,
    allowedIps: null,
    allowedSessions: null,
    isActive: true,
    expiresAt: null,
    lastUsedAt: null,
    usageCount: 0,
    tenantId: null,
    scopes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockContext(
  headers: Record<string, string> = {},
  params: Record<string, string> = {},
): ExecutionContext {
  const request = {
    headers,
    params,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let authService: jest.Mocked<Partial<AuthService>>;
  let reflector: jest.Mocked<Reflector>;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let clerkToken: jest.Mocked<Partial<ClerkTokenService>>;
  let clerkProvisioning: jest.Mocked<Partial<ClerkProvisioningService>>;

  beforeEach(() => {
    authService = {
      validateApiKey: jest.fn(),
      hasPermission: jest.fn(),
    };

    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    jwtService = {
      verify: jest.fn(() => {
        throw new Error('not an embed JWT');
      }),
    };

    // By default not a Clerk token → guard falls through to embed/API-key paths.
    clerkToken = { verify: jest.fn().mockResolvedValue(null) };
    clerkProvisioning = { resolveFromClaims: jest.fn() };

    guard = new ApiKeyGuard(
      authService as AuthService,
      reflector,
      jwtService as JwtService,
      clerkToken as ClerkTokenService,
      clerkProvisioning as ClerkProvisioningService,
    );
  });

  it('should accept a valid Clerk token and populate tenant context', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false); // not public

    (clerkToken.verify as jest.Mock).mockResolvedValue({ userId: 'U', orgId: 'org', orgRole: 'org:admin' });
    (clerkProvisioning.resolveFromClaims as jest.Mock).mockResolvedValue({
      tenantId: 'T',
      userId: 'U',
      role: 'admin',
    });

    const request = {
      headers: { authorization: 'Bearer clerk.jwt.token' },
      params: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect((request as { tenantId?: string }).tenantId).toBe('T');
    expect((request as { userId?: string }).userId).toBe('U');
    expect(authService.validateApiKey).not.toHaveBeenCalled();
  });

  it('should reject a Clerk user without an active organization', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false);
    (clerkToken.verify as jest.Mock).mockResolvedValue({ userId: 'U' });
    (clerkProvisioning.resolveFromClaims as jest.Mock).mockResolvedValue(null);

    const context = createMockContext({ authorization: 'Bearer clerk.jwt.token' });

    await expect(guard.canActivate(context)).rejects.toThrow('No active organization');
  });

  it('should allow access to @Public() routes without API key', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true); // isPublic = true

    const context = createMockContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(authService.validateApiKey).not.toHaveBeenCalled();
  });

  it('should reject requests without X-API-Key header', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false); // not public

    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('API key is required');
  });

  it('should accept X-API-Key header', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false) // not public
      .mockReturnValueOnce(undefined); // no required role

    const apiKey = createMockApiKey();
    (authService.validateApiKey as jest.Mock).mockResolvedValue(apiKey);

    const context = createMockContext({ 'x-api-key': 'my-key' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(authService.validateApiKey).toHaveBeenCalledWith('my-key', '127.0.0.1', undefined);
  });

  it('should accept Authorization Bearer header', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(undefined);

    const apiKey = createMockApiKey();
    (authService.validateApiKey as jest.Mock).mockResolvedValue(apiKey);

    const context = createMockContext({ authorization: 'Bearer my-bearer-key' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(authService.validateApiKey).toHaveBeenCalledWith('my-bearer-key', '127.0.0.1', undefined);
  });

  it('should reject when API key validation fails', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false);

    (authService.validateApiKey as jest.Mock).mockRejectedValue(new UnauthorizedException('Invalid API key'));

    const context = createMockContext({ 'x-api-key': 'bad-key' });

    await expect(guard.canActivate(context)).rejects.toThrow('Invalid API key');
  });

  it('should reject when role permission is insufficient', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false) // not public
      .mockReturnValueOnce(ApiKeyRole.ADMIN); // required role = ADMIN

    const apiKey = createMockApiKey({ role: ApiKeyRole.VIEWER });
    (authService.validateApiKey as jest.Mock).mockResolvedValue(apiKey);
    (authService.hasPermission as jest.Mock).mockReturnValue(false);

    const context = createMockContext({ 'x-api-key': 'viewer-key' });

    await expect(guard.canActivate(context)).rejects.toThrow('Insufficient permissions');
  });

  it('should pass session ID from route params to validateApiKey', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(undefined);

    const apiKey = createMockApiKey();
    (authService.validateApiKey as jest.Mock).mockResolvedValue(apiKey);

    const context = createMockContext({ 'x-api-key': 'key' }, { sessionId: 'sess-123' });
    await guard.canActivate(context);

    expect(authService.validateApiKey).toHaveBeenCalledWith('key', '127.0.0.1', 'sess-123');
  });

  it('should extract client IP from X-Forwarded-For header', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(undefined);

    const apiKey = createMockApiKey();
    (authService.validateApiKey as jest.Mock).mockResolvedValue(apiKey);

    const context = createMockContext({
      'x-api-key': 'key',
      'x-forwarded-for': '203.0.113.50, 70.41.3.18',
    });
    await guard.canActivate(context);

    expect(authService.validateApiKey).toHaveBeenCalledWith('key', '203.0.113.50', undefined);
  });
});
