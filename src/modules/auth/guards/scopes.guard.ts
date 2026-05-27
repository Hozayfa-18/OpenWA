import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPES_KEY } from '../decorators/auth.decorators';
import { RequestWithTenant } from '../../../common/tenant/request-with-tenant.interface';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredScopes || requiredScopes.length === 0) return true;

    const req = context.switchToHttp().getRequest<RequestWithTenant>();

    // JWT users (with userRole) bypass scope checks — they use @Roles() instead
    if (req.userRole) return true;

    const grantedScopes = req.scopes ?? [];
    const hasAll = requiredScopes.every(s => grantedScopes.includes(s));

    if (!hasAll) {
      throw new ForbiddenException(`Missing required scopes: ${requiredScopes.join(', ')}`);
    }

    return true;
  }
}
