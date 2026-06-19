import type { createAdminApp } from "../routes/admin";
import { createAuthApp } from "../routes/auth";
import type { SamDb } from "../db";

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function jsonHeaders(token: string): Record<string, string> {
  return { "Content-Type": "application/json", ...authHeaders(token) };
}

export async function bootstrapOwnerToken(db: SamDb): Promise<string> {
  const auth = createAuthApp(db);
  const response = await auth.request("/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "owner",
      password: "owner-password"
    })
  });
  const body = await response.json() as { token: string };
  return body.token;
}

export async function createEditorToken(db: SamDb, admin: ReturnType<typeof createAdminApp>): Promise<string> {
  const ownerToken = await bootstrapOwnerToken(db);
  await admin.request("/users", {
    method: "POST",
    headers: jsonHeaders(ownerToken),
    body: JSON.stringify({
      username: "editor",
      password: "editor-password",
      role: "editor"
    })
  });
  const auth = createAuthApp(db);
  const login = await auth.request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "editor",
      password: "editor-password"
    })
  });
  const body = await login.json() as { token: string };
  return body.token;
}
