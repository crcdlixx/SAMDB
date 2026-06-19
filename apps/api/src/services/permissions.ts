import { canRole, type Permission, type Role } from "@samdb/shared";

export function roleCan(role: Role, permission: Permission): boolean {
  return canRole(role, permission);
}

export function isReviewOnlyWorkPatch(payload: Record<string, unknown>): boolean {
  const allowed = new Set(["recordStatus", "visibility", "reviewer"]);
  return Object.keys(payload).length > 0 && Object.keys(payload).every((key) => allowed.has(key));
}
