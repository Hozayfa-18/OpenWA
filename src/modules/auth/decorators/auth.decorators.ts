import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyRole } from '../entities/api-key.entity';
import { UserRole } from '../../users/entities/user.entity';
import { Request } from 'express';
import { ApiKey } from '../entities/api-key.entity';
import { RequestWithTenant } from '../../../common/tenant/request-with-tenant.interface';

export const REQUIRED_ROLE_KEY   = 'requiredRole';
export const PUBLIC_KEY          = 'isPublic';
export const ROLES_KEY           = 'roles';
export const SCOPES_KEY          = 'scopes';

/** Mark a route as requiring a specific ApiKeyRole (legacy, machine auth) */
export const RequireRole = (role: ApiKeyRole) => SetMetadata(REQUIRED_ROLE_KEY, role);

/** Mark a route as public — no auth required */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Mark a route as requiring one of the given UserRoles (JWT auth) */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Mark a route as requiring an API key scope (machine auth) */
export const Scopes = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes);

/** Get the current API key from request (machine auth routes) */
export const CurrentApiKey = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ApiKey | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { apiKey?: ApiKey }>();
    return request.apiKey;
  },
);

/** Get the current authenticated user id from request (JWT auth routes) */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithTenant>();
    return request.userId;
  },
);
