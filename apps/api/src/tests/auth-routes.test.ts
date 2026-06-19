import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createAdminApp } from "../routes/admin";
import { createAuthApp } from "../routes/auth";

function jsonRequest(body: unknown) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

describe("auth routes", () => {
  it("bootstraps the first owner and prevents a second bootstrap", async () => {
    const db = createMemoryDatabase();
    const app = createAuthApp(db);

    const statusBefore = await (await app.request("/bootstrap-status")).json() as { needsBootstrap: boolean };
    expect(statusBefore.needsBootstrap).toBe(true);

    const bootstrapResponse = await app.request("/bootstrap", jsonRequest({
      username: "owner",
      displayName: "Owner",
      password: "owner-password"
    }));
    expect(bootstrapResponse.status).toBe(201);
    const bootstrapBody = await bootstrapResponse.json() as {
      token: string;
      user: { username: string; role: string; displayName: string | null };
    };
    expect(bootstrapBody.token).toEqual(expect.any(String));
    expect(bootstrapBody.user).toMatchObject({
      username: "owner",
      role: "owner",
      displayName: "Owner"
    });

    const statusAfter = await (await app.request("/bootstrap-status")).json() as { needsBootstrap: boolean };
    expect(statusAfter.needsBootstrap).toBe(false);

    const secondBootstrap = await app.request("/bootstrap", jsonRequest({
      username: "other",
      password: "owner-password"
    }));
    expect(secondBootstrap.status).toBe(409);
  });

  it("logs in, returns the current user, and logs out", async () => {
    const db = createMemoryDatabase();
    const app = createAuthApp(db);

    await app.request("/bootstrap", jsonRequest({
      username: "owner",
      password: "owner-password"
    }));

    const wrongPassword = await app.request("/login", jsonRequest({
      username: "owner",
      password: "wrong-password"
    }));
    expect(wrongPassword.status).toBe(401);

    const loginResponse = await app.request("/login", jsonRequest({
      username: "owner",
      password: "owner-password"
    }));
    expect(loginResponse.status).toBe(200);
    const loginBody = await loginResponse.json() as { token: string };

    const meResponse = await app.request("/me", {
      headers: { Authorization: `Bearer ${loginBody.token}` }
    });
    expect(meResponse.status).toBe(200);
    const meBody = await meResponse.json() as { user: { username: string; role: string } };
    expect(meBody.user).toMatchObject({ username: "owner", role: "owner" });

    const logoutResponse = await app.request("/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${loginBody.token}` }
    });
    expect(logoutResponse.status).toBe(200);

    const meAfterLogout = await app.request("/me", {
      headers: { Authorization: `Bearer ${loginBody.token}` }
    });
    expect(meAfterLogout.status).toBe(401);
  });

  it("records login and logout audit events", async () => {
    const db = createMemoryDatabase();
    const auth = createAuthApp(db);
    const admin = createAdminApp(db);

    const bootstrap = await auth.request("/bootstrap", jsonRequest({
      username: "owner",
      password: "owner-password"
    }));
    const bootstrapBody = await bootstrap.json() as { token: string };

    const loginResponse = await auth.request("/login", jsonRequest({
      username: "owner",
      password: "owner-password"
    }));
    const loginBody = await loginResponse.json() as { token: string };

    await auth.request("/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${loginBody.token}` }
    });

    const logs = await (await admin.request("/audit-logs?limit=10", {
      headers: { Authorization: `Bearer ${bootstrapBody.token}` }
    })).json() as { items: Array<{ entityType: string; action: string; actor: string | null }> };
    expect(logs.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: "auth", action: "login", actor: "owner" }),
      expect.objectContaining({ entityType: "auth", action: "logout", actor: "owner" })
    ]));
  });
});
