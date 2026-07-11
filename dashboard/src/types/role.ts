// Role types for RBAC — unified with the backend UserRole enum.
export type UserRole = 'owner' | 'admin' | 'manager' | 'sales_rep' | 'quality_control';

export interface RoleContextType {
  role: UserRole | null;
  setRole: (role: UserRole | null) => void;
  isAdmin: boolean; // owner or admin
  canWrite: boolean; // owner, admin, or manager
}
