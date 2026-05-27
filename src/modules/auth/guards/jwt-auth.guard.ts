import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from '../decorators/auth.decorators';
import { RequestWithTenant } from '../../../common/tenant/request-with-tenant.interface';
import { JwtPayload } from '../strategies/jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Let Passport validate the JWT — sets request.user = JwtPayload on success,
    // throws UnauthorizedException on failure (invalid/expired token).
    const result = (await super.canActivate(context)) as boolean;
    if (!result) return false;

    // Populate TenantContext fields on the raw request so TenantContext can read them.
    const req = context.switchToHttp().getRequest<RequestWithTenant & { user: JwtPayload }>();
    req.tenantId = req.user.tenantId;
    req.userId   = req.user.sub;
    req.userRole = req.user.role;

    return true;
  }
}
