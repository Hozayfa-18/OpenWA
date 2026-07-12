import type { UserRole } from '../types/role';

const VALID: UserRole[] = ['owner', 'admin', 'manager', 'sales_rep', 'quality_control'];

/** Map a Clerk org role ("org:admin" or "admin") to the unified UI UserRole; default sales_rep. */
export const mapClerkRoleToUi = (role: string | undefined | null): UserRole => {
  if (!role) return 'sales_rep';
  const bare = role.startsWith('org:') ? role.slice(4) : role;
  return (VALID as string[]).includes(bare) ? (bare as UserRole) : 'sales_rep';
};

export const isAdminRole = (r: UserRole | null): boolean => r === 'owner' || r === 'admin';

export const canWriteRole = (r: UserRole | null): boolean =>
  r === 'owner' || r === 'admin' || r === 'manager';
