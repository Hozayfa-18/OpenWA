import { Request } from 'express';
import { UserRole } from '../../modules/users/entities/user.entity';

export interface RequestWithTenant extends Request {
  tenantId?: string;
  userId?: string;
  userRole?: UserRole;
  scopes?: string[];
}
