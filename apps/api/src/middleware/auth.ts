import type { Context, MiddlewareHandler } from "hono";
import type { Permission, Role } from "@samdb/shared";
import type { SamDb } from "../db";
import { getSessionUser } from "../services/sessions";
import { roleCan } from "../services/permissions";
import type { PublicUser } from "../services/users";

type Variables = {
  user: PublicUser;
};

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export function requireAuth(db: SamDb): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, next) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (!token) return c.json({ error: "Unauthorized" }, 401);
    const user = getSessionUser(db, token);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    c.set("user", user);
    await next();
  };
}

export function requirePermission(permission: Permission): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, next) => {
    const user = c.get("user");
    if (!roleCan(user.role, permission)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  };
}

export function getActor(c: Context<{ Variables: Variables }>): string {
  return c.get("user").username;
}

export function getRole(c: Context<{ Variables: Variables }>): Role {
  return c.get("user").role;
}
