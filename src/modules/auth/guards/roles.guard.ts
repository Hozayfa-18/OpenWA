import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/auth.decorators';
import { RequestWithTenant } from '../../../common/tenant/request-with-tenant.interface';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.OWNER]:           5,
  [UserRole.ADMIN]:           4,
  [UserRole.MANAGER]:         3,
  [UserRole.SALES_REP]:       2,
  [UserRole.QUALITY_CONTROL]: 2,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @Roles() decorator, this guard is a no-op
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<RequestWithTenant>();

    // API key requests have no userRole — they use ScopesGuard instead
    if (!req.userRole) return true;

    const userLevel = ROLE_HIERARCHY[req.userRole] ?? 0;
    const canAccess = requiredRoles.some(r => userLevel >= ROLE_HIERARCHY[r]);

    if (!canAccess) {
      throw new ForbiddenException(`Role '${req.userRole}' does not have access`);
    }

    return true;
  }
}
