export const roles = ["owner", "editor", "reviewer", "viewer", "public"] as const;
export type Role = typeof roles[number];

export const permissions = [
  "read_public",
  "read_admin",
  "write_work",
  "review_work",
  "import_export",
  "read_audit",
  "manage_users",
  "system_settings"
] as const;

export type Permission = typeof permissions[number];

const rolePermissions: Record<Role, Permission[]> = {
  owner: [...permissions],
  editor: ["read_public", "read_admin", "write_work", "import_export"],
  reviewer: ["read_public", "read_admin", "review_work", "read_audit"],
  viewer: ["read_public", "read_admin"],
  public: ["read_public"]
};

export function canRole(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function isRole(value: string): value is Role {
  return roles.includes(value as Role);
}
