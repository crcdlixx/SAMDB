import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import { isRole, type Role } from "@samdb/shared";
import type { SamDb } from "../db";
import { nowIso } from "../db";

export type UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  password_hash: string;
  role: Role;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type PublicUser = {
  id: string;
  username: string;
  displayName: string | null;
  role: Role;
  isActive: boolean;
};

export type CreateUserPayload = {
  username: string;
  password: string;
  displayName?: string | null;
  role: Role;
};

export type UpdateUserPayload = {
  role?: Role;
  displayName?: string | null;
  isActive?: boolean;
};

export function countUsers(db: SamDb): number {
  const row = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  return row.count;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [scheme, salt, storedHash] = passwordHash.split(":");
  if (scheme !== "scrypt" || !salt || !storedHash) return false;
  const actual = Buffer.from(scryptSync(password, salt, 64).toString("base64url"));
  const expected = Buffer.from(storedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createUser(db: SamDb, payload: CreateUserPayload): PublicUser {
  if (!isRole(payload.role)) {
    throw new Error(`Invalid role: ${payload.role}`);
  }
  const now = nowIso();
  const id = nanoid();
  db.prepare(`
    INSERT INTO users (id, username, display_name, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    payload.username,
    payload.displayName ?? null,
    hashPassword(payload.password),
    payload.role,
    now,
    now
  );
  return {
    id,
    username: payload.username,
    displayName: payload.displayName ?? null,
    role: payload.role,
    isActive: true
  };
}

export function getUserByUsername(db: SamDb, username: string): UserRow | null {
  return (db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined) ?? null;
}

export function getUserById(db: SamDb, id: string): UserRow | null {
  return (db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined) ?? null;
}

export function listUsers(db: SamDb): { items: PublicUser[] } {
  const rows = db.prepare("SELECT * FROM users ORDER BY username").all() as UserRow[];
  return { items: rows.map(toPublicUser) };
}

export function updateUserByUsername(db: SamDb, username: string, payload: UpdateUserPayload): PublicUser {
  const existing = getUserByUsername(db, username);
  if (!existing) throw new Error(`User not found: ${username}`);
  if (payload.role && !isRole(payload.role)) throw new Error(`Invalid role: ${payload.role}`);

  db.prepare(`
    UPDATE users SET
      display_name = ?,
      role = ?,
      is_active = ?,
      updated_at = ?
    WHERE username = ?
  `).run(
    payload.displayName !== undefined ? payload.displayName : existing.display_name,
    payload.role ?? existing.role,
    payload.isActive !== undefined ? (payload.isActive ? 1 : 0) : existing.is_active,
    nowIso(),
    username
  );

  if (payload.isActive === false) {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(existing.id);
  }

  const updated = getUserByUsername(db, username);
  if (!updated) throw new Error("User disappeared after update");
  return toPublicUser(updated);
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isActive: Boolean(row.is_active)
  };
}
