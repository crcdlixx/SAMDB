import { Hono } from "hono";
import type { SamDb } from "../db";
import { createAuditLog } from "../services/auditLogs";
import { createSession, deleteSession, getSessionUser } from "../services/sessions";
import { countUsers, createUser, getUserByUsername, toPublicUser, verifyPassword } from "../services/users";

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export function createAuthApp(db: SamDb): Hono {
  const app = new Hono();

  app.get("/bootstrap-status", (c) => c.json({ needsBootstrap: countUsers(db) === 0 }));

  app.post("/bootstrap", async (c) => {
    if (countUsers(db) > 0) return c.json({ error: "Bootstrap already completed" }, 409);
    const body = await c.req.json() as { username?: string; password?: string; displayName?: string | null };
    if (!body.username || !body.password) return c.json({ error: "Username and password are required" }, 400);
    const user = createUser(db, {
      username: body.username,
      password: body.password,
      displayName: body.displayName ?? null,
      role: "owner"
    });
    const session = createSession(db, user.id);
    createAuditLog(db, {
      entityType: "user",
      entityId: user.id,
      action: "bootstrap",
      actor: user.username,
      after: user
    });
    return c.json({ user, token: session.token, expiresAt: session.expiresAt }, 201);
  });

  app.post("/login", async (c) => {
    const body = await c.req.json() as { username?: string; password?: string };
    if (!body.username || !body.password) return c.json({ error: "Username and password are required" }, 400);
    const user = getUserByUsername(db, body.username);
    if (!user || !user.is_active || !verifyPassword(body.password, user.password_hash)) {
      return c.json({ error: "Invalid username or password" }, 401);
    }
    const session = createSession(db, user.id);
    createAuditLog(db, {
      entityType: "auth",
      entityId: user.id,
      action: "login",
      actor: user.username
    });
    return c.json({ user: toPublicUser(user), token: session.token, expiresAt: session.expiresAt });
  });

  app.get("/me", (c) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (!token) return c.json({ error: "Unauthorized" }, 401);
    const user = getSessionUser(db, token);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return c.json({ user });
  });

  app.post("/logout", (c) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (token) {
      const user = getSessionUser(db, token);
      if (user) {
        createAuditLog(db, {
          entityType: "auth",
          entityId: user.id,
          action: "logout",
          actor: user.username
        });
      }
      deleteSession(db, token);
    }
    return c.json({ ok: true });
  });

  return app;
}
