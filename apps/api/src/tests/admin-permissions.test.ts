import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createAdminApp } from "../routes/admin";
import { createAuthApp } from "../routes/auth";

function jsonRequest(body: unknown, token?: string) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  };
}

async function bootstrapOwner(db = createMemoryDatabase()) {
  const auth = createAuthApp(db);
  const response = await auth.request("/bootstrap", jsonRequest({
    username: "owner",
    password: "owner-password"
  }));
  const body = await response.json() as { token: string };
  return { db, auth, ownerToken: body.token };
}

async function createUser(admin: ReturnType<typeof createAdminApp>, auth: ReturnType<typeof createAuthApp>, ownerToken: string, username: string, role: string) {
  const response = await admin.request("/users", jsonRequest({
    username,
    password: `${username}-password`,
    role
  }, ownerToken));
  expect(response.status).toBe(201);
  const login = await auth.request("/login", jsonRequest({
    username,
    password: `${username}-password`
  }));
  return (await login.json() as { token: string }).token;
}

function workPayload(id: string) {
  return {
    id,
    title: `Work ${id}`,
    aliases: [],
    tags: [],
    summaryShort: "Permission test work.",
    sourcePrimary: "https://example.test/permission",
    recordStatus: "draft",
    visibility: "public"
  };
}

describe("admin permissions", () => {
  it("requires a token for admin routes", async () => {
    const db = createMemoryDatabase();
    const admin = createAdminApp(db);

    const response = await admin.request("/works");

    expect(response.status).toBe(401);
  });

  it("allows viewers to read admin data but not write works", async () => {
    const { db, auth, ownerToken } = await bootstrapOwner();
    const admin = createAdminApp(db);
    const viewerToken = await createUser(admin, auth, ownerToken, "viewer", "viewer");

    const listResponse = await admin.request("/works", {
      headers: { Authorization: `Bearer ${viewerToken}` }
    });
    expect(listResponse.status).toBe(200);

    const createResponse = await admin.request("/works", jsonRequest(workPayload("viewer-work"), viewerToken));
    expect(createResponse.status).toBe(403);
  });

  it("allows editors to create works", async () => {
    const { db, auth, ownerToken } = await bootstrapOwner();
    const admin = createAdminApp(db);
    const editorToken = await createUser(admin, auth, ownerToken, "editor", "editor");

    const createResponse = await admin.request("/works", jsonRequest(workPayload("editor-work"), editorToken));

    expect(createResponse.status).toBe(201);
  });

  it("allows reviewers to update review fields but not create works", async () => {
    const { db, auth, ownerToken } = await bootstrapOwner();
    const admin = createAdminApp(db);
    const editorToken = await createUser(admin, auth, ownerToken, "editor", "editor");
    const reviewerToken = await createUser(admin, auth, ownerToken, "reviewer", "reviewer");
    await admin.request("/works", jsonRequest(workPayload("review-work"), editorToken));

    const createResponse = await admin.request("/works", jsonRequest(workPayload("reviewer-work"), reviewerToken));
    expect(createResponse.status).toBe(403);

    const reviewResponse = await admin.request("/works/review-work", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${reviewerToken}`
      },
      body: JSON.stringify({ recordStatus: "published", visibility: "public" })
    });
    expect(reviewResponse.status).toBe(200);

    const titleResponse = await admin.request("/works/review-work", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${reviewerToken}`
      },
      body: JSON.stringify({ title: "Reviewer should not edit title" })
    });
    expect(titleResponse.status).toBe(403);
  });

  it("lets owners list users, update roles, and disable users with audit logs", async () => {
    const { db, auth, ownerToken } = await bootstrapOwner();
    const admin = createAdminApp(db);
    const viewerToken = await createUser(admin, auth, ownerToken, "viewer", "viewer");

    const forbiddenList = await admin.request("/users", {
      headers: { Authorization: `Bearer ${viewerToken}` }
    });
    expect(forbiddenList.status).toBe(403);

    const listResponse = await admin.request("/users", {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json() as { items: Array<{ username: string; role: string; isActive: boolean }> };
    expect(listBody.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ username: "owner", role: "owner", isActive: true }),
      expect.objectContaining({ username: "viewer", role: "viewer", isActive: true })
    ]));

    const viewer = listBody.items.find((item) => item.username === "viewer");
    expect(viewer).toBeTruthy();

    const updateResponse = await admin.request(`/users/${encodeURIComponent("viewer")}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ role: "editor", isActive: false })
    });
    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toMatchObject({
      username: "viewer",
      role: "editor",
      isActive: false
    });

    const disabledLogin = await auth.request("/login", jsonRequest({
      username: "viewer",
      password: "viewer-password"
    }));
    expect(disabledLogin.status).toBe(401);

    const logs = await (await admin.request("/audit-logs?limit=10", {
      headers: { Authorization: `Bearer ${ownerToken}` }
    })).json() as { items: Array<{ entityType: string; action: string; actor: string | null }> };
    expect(logs.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: "user", action: "update", actor: "owner" })
    ]));
  });
});
