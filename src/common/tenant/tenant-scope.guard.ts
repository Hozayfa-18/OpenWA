import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../../modules/session/entities/session.entity';
import type { RequestWithTenant } from './request-with-tenant.interface';

/**
 * Enforces that a session-scoped route only ever touches a session owned by the
 * authenticated tenant. Runs AFTER the global `ApiKeyGuard` (which populates
 * `request.tenantId`).
 *
 * Resolution: the session id comes from `:sessionId` (messages/webhooks/etc.)
 * or `:id` (the sessions controller's own routes). Routes without a session id
 * param (list/create/stats) are scoped at the service layer instead and pass
 * through here.
 *
 * On any mismatch — or a non-existent session — we return **404, never 403**, so
 * the API does not become an existence oracle that confirms another tenant's
 * session ids.
 */
@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const params = (request.params ?? {}) as Record<string, string | undefined>;
    const sessionId = params.sessionId ?? params.id;

    // No session in the route → ownership is enforced by the service-layer
    // tenant filter (e.g. findAllForTenant), not here.
    if (!sessionId) {
      return true;
    }

    const tenantId = request.tenantId;
    if (!tenantId) {
      // Past authentication we should always have a tenant. If not, refuse to
      // prove the session exists.
      throw new NotFoundException('Session not found');
    }

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      select: ['id', 'tenantId'],
    });

    if (!session || session.tenantId !== tenantId) {
      throw new NotFoundException('Session not found');
    }

    return true;
  }
}
