import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKey } from '../../auth/entities/api-key.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequestWithTenant } from '../../../common/tenant/request-with-tenant.interface';

@Injectable()
export class CrmAuthGuard extends JwtAuthGuard implements CanActivate {
  constructor(reflector: Reflector) {
    super(reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenant & { apiKey?: ApiKey }>();

    if (request.apiKey) {
      return true;
    }

    return super.canActivate(context);
  }
}
