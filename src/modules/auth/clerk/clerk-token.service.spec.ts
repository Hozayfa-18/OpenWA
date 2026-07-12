import { ClerkTokenService } from './clerk-token.service';

const verifyToken = jest.fn();
jest.mock('@clerk/backend', () => ({ verifyToken: (...a: unknown[]) => verifyToken(...a) }));

const cfg = {
  get: (k: string) => ({ 'clerk.secretKey': 'sk', 'clerk.jwtIssuer': 'https://iss' } as Record<string, string>)[k],
};

describe('ClerkTokenService', () => {
  beforeEach(() => verifyToken.mockReset());

  it('returns claims on valid token', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_1', org_id: 'org_1', org_role: 'org:admin', email: 'a@b.c' });
    const svc = new ClerkTokenService(cfg as never);
    await expect(svc.verify('t')).resolves.toEqual(
      expect.objectContaining({ userId: 'user_1', orgId: 'org_1', orgRole: 'org:admin', email: 'a@b.c' }),
    );
  });

  it('reads org from the compact `o` claim (newer session tokens)', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_1', o: { id: 'org_2', rol: 'admin', slg: 'acme' } });
    const svc = new ClerkTokenService(cfg as never);
    await expect(svc.verify('t')).resolves.toEqual(
      expect.objectContaining({ userId: 'user_1', orgId: 'org_2', orgRole: 'admin' }),
    );
  });

  it('returns null on failure', async () => {
    verifyToken.mockRejectedValue(new Error('bad'));
    const svc = new ClerkTokenService(cfg as never);
    await expect(svc.verify('t')).resolves.toBeNull();
  });

  it('returns null when secret key not configured', async () => {
    const emptyCfg = { get: () => undefined };
    const svc = new ClerkTokenService(emptyCfg as never);
    await expect(svc.verify('t')).resolves.toBeNull();
    expect(verifyToken).not.toHaveBeenCalled();
  });
});
