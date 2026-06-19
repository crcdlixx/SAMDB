import { createHash, randomBytes } from "node:crypto";
import { nanoid } from "nanoid";
import type { SamDb } from "../db";
import { nowIso } from "../db";
import { getUserById, toPublicUser, type PublicUser, type UserRow } from "./users";

const SESSION_DAYS = 14;

type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_seen_at: string | null;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(db: SamDb, userId: string): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString("base64url");
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(nanoid(), userId, hashToken(token), expiresAt, createdAt, createdAt);
  return { token, expiresAt };
}

export function getSessionUser(db: SamDb, token: string): PublicUser | null {
  const session = db.prepare("SELECT * FROM sessions WHERE token_hash = ?").get(hashToken(token)) as SessionRow | undefined;
  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(session.id);
    return null;
  }
  const user = getUserById(db, session.user_id) as UserRow | null;
  if (!user || !user.is_active) return null;
  db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(nowIso(), session.id);
  return toPublicUser(user);
}

export function deleteSession(db: SamDb, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}
