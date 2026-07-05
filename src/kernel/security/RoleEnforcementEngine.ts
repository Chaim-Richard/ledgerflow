export type Role = 'Viewer' | 'Bookkeeper' | 'Manager' | 'Admin' | 'Owner';

export class RoleEnforcementEngine {
  private static permissions: Record<Role, string[]> = {
    Owner: ['*'],
    Admin: ['*'],
    Manager: ['CREATE_INVOICE', 'APPROVE_BILL', 'VIEW_REPORTS'],
    Bookkeeper: ['CREATE_JOURNAL_ENTRY', 'RECONCILE_ACCOUNTS', 'VIEW_REPORTS'],
    Viewer: ['VIEW_REPORTS']
  };

  static hasPermission(userRole: Role, action: string): boolean {
    const roles = this.permissions[userRole] || [];
    if (roles.includes('*')) return true;
    return roles.includes(action);
  }

  static getPermissions(userRole: Role): string[] {
    return this.permissions[userRole] || [];
  }
}
