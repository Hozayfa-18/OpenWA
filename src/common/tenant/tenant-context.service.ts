import { Injectable, Inject, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { UserRole } from '../../modules/users/entities/user.entity';
import { RequestWithTenant } from './request-with-tenant.interface';

@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  constructor(
    @Inject(REQUEST) private readonly req: RequestWithTenant,
  ) {}

  get tenantId(): string {
    if (!this.req.tenantId) {
      throw new UnauthorizedException('Tenant context not populated');
    }
    return this.req.tenantId;
  }

  get userId(): string | undefined {
    return this.req.userId;
  }

  get role(): UserRole | undefined {
    return this.req.userRole;
  }

  get scopes(): string[] {
    return this.req.scopes ?? [];
  }
}
