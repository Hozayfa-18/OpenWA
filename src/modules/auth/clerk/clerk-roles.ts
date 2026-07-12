import { UserRole } from '../../users/entities/user.entity';

const VALID = new Set<string>(Object.values(UserRole));

/** Map a Clerk org role (e.g. "org:admin" or "admin") to a UserRole; default SALES_REP. */
export const mapClerkRole = (orgRole: string | undefined): UserRole => {
  if (!orgRole) return UserRole.SALES_REP;
  const bare = orgRole.startsWith('org:') ? orgRole.slice(4) : orgRole;
  return VALID.has(bare) ? (bare as UserRole) : UserRole.SALES_REP;
};
