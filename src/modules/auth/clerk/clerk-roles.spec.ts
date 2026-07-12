import { mapClerkRole } from './clerk-roles';
import { UserRole } from '../../users/entities/user.entity';

describe('mapClerkRole', () => {
  it('maps prefixed org roles to UserRole', () => {
    expect(mapClerkRole('org:owner')).toBe(UserRole.OWNER);
    expect(mapClerkRole('org:admin')).toBe(UserRole.ADMIN);
    expect(mapClerkRole('org:manager')).toBe(UserRole.MANAGER);
    expect(mapClerkRole('org:sales_rep')).toBe(UserRole.SALES_REP);
    expect(mapClerkRole('org:quality_control')).toBe(UserRole.QUALITY_CONTROL);
  });

  it('accepts unprefixed roles', () => {
    expect(mapClerkRole('admin')).toBe(UserRole.ADMIN);
  });

  it('defaults unknown/undefined to SALES_REP', () => {
    expect(mapClerkRole(undefined)).toBe(UserRole.SALES_REP);
    expect(mapClerkRole('org:superuser')).toBe(UserRole.SALES_REP);
  });
});
