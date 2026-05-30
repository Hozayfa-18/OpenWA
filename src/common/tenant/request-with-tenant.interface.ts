import { Request } from 'express';
import { UserRole } from '../../modules/users/entities/user.entity';
import type { EmbedJwtPayload } from '../../modules/auth/strategies/embed-jwt.strategy';

export interface RequestWithTenant extends Request {
  tenantId?: string;
  userId?: string;
  userRole?: UserRole;
  scopes?: string[];
  embed?: EmbedJwtPayload;
}
