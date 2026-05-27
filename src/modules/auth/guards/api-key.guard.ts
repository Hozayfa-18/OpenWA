import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { ApiKey, ApiKeyRole } from '../entities/api-key.entity';
import { REQUIRED_ROLE_KEY, PUBLIC_KEY, ROLES_KEY } from '../decorators/auth.decorators';
import { RequestWithTenant } from '../../../common/tenant/request-with-tenant.interface';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithTenant & { apiKey?: ApiKey }>();
    const authHeader = request.headers['authorization'];

    if (authHeader?.startsWith('Bearer ') && !request.headers['x-api-key']) {
      const requiredJwtRoles = this.reflector.getAllAndOverride(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (requiredJwtRoles) {
        return true;
      }
    }

    const apiKeyHeader = this.extractApiKey(request);

    if (!apiKeyHeader) {
      throw new UnauthorizedException('API key is required');
    }

    const sessionId = (request.params['sessionId'] || request.params['id']) as string | undefined;
    const clientIp  = this.getClientIp(request);

    const apiKey = await this.authService.validateApiKey(apiKeyHeader, clientIp, sessionId);

    // Check legacy role permission
    const requiredRole = this.reflector.getAllAndOverride<ApiKeyRole>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRole && !this.authService.hasPermission(apiKey, requiredRole)) {
      throw new UnauthorizedException(`Insufficient permissions. Required: ${requiredRole}`);
    }

    // Attach API key + populate TenantContext fields on request
    request.apiKey   = apiKey;
    request.tenantId = apiKey.tenantId ?? undefined;
    request.scopes   = apiKey.scopes   ?? [];

    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    const xApiKey = request.headers['x-api-key'] as string;
    if (xApiKey) return xApiKey;
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);
    return undefined;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) return (forwarded as string).split(',')[0].trim();
    return request.ip || request.socket.remoteAddress || '';
  }
}
