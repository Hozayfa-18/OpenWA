import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import { createLogger } from '../../../common/services/logger.service';

export interface ClerkClaims {
  userId: string;
  orgId?: string;
  orgRole?: string;
  email?: string;
  name?: string;
}

@Injectable()
export class ClerkTokenService {
  private readonly logger = createLogger('ClerkTokenService');

  constructor(private readonly config: ConfigService) {}

  /** Verify a Clerk session JWT via JWKS. Returns null (never throws) on failure. */
  async verify(token: string): Promise<ClerkClaims | null> {
    const secretKey = this.config.get<string>('clerk.secretKey');
    if (!secretKey) return null;

    try {
      // verifyToken validates the issuer against the instance behind secretKey; no explicit issuer needed.
      const payload = await verifyToken(token, { secretKey });
      const p = payload as Record<string, unknown>;
      if (typeof p.sub !== 'string') return null;

      // Newer Clerk session tokens carry organization data in a compact `o` claim
      // ({ id, rol, slg }); older/templated tokens use flat org_id/org_role. Support both.
      const o = (p.o ?? undefined) as Record<string, unknown> | undefined;
      const orgId =
        typeof p.org_id === 'string' ? p.org_id : typeof o?.id === 'string' ? o.id : undefined;
      const orgRole =
        typeof p.org_role === 'string' ? p.org_role : typeof o?.rol === 'string' ? o.rol : undefined;

      return {
        userId: p.sub,
        orgId,
        orgRole,
        email: typeof p.email === 'string' ? p.email : undefined,
        name: typeof p.name === 'string' ? p.name : undefined,
      };
    } catch (err) {
      this.logger.debug('Clerk token verification failed', { error: String(err) });
      return null;
    }
  }
}
