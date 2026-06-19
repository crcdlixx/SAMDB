import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createAdminApp } from "../routes/admin";
import { createWork } from "../services/works";
import { authHeaders, bootstrapOwnerToken, jsonHeaders } from "./authTestHelpers";

function seedWork(db: ReturnType<typeof createMemoryDatabase>) {
  createWork(db, {
    id: "release-work",
    title: "Release Work",
    aliases: [],
    tags: [],
    summaryShort: "A work with releases and access entries.",
    sourcePrimary: "https://example.test/release-work",
    recordStatus: "published",
    visibility: "public"
  });
}

describe("releases and access entries admin CRUD", () => {
  it("updates releases and deletes access entries with audit logs", async () => {
    const db = createMemoryDatabase();
    seedWork(db);
    const app = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);

    const createReleaseResponse = await app.request("/works/release-work/releases", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        releaseId: "rel-main",
        releaseTitle: "Original Release",
        audioTracks: [],
        subtitleTracks: [],
        releaseStatus: "draft"
      })
    });
    expect(createReleaseResponse.status).toBe(201);

    const updateReleaseResponse = await app.request("/releases/rel-main", {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        releaseTitle: "Updated Release",
        resolution: "1080p",
        releaseStatus: "published"
      })
    });
    expect(updateReleaseResponse.status).toBe(200);
    expect(await updateReleaseResponse.json()).toMatchObject({
      releaseId: "rel-main",
      releaseTitle: "Updated Release",
      resolution: "1080p",
      releaseStatus: "published"
    });

    const createAccessResponse = await app.request("/releases/rel-main/access", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        accessId: "acc-main",
        accessType: "official_streaming",
        platform: "Example Platform",
        url: "https://example.test/watch",
        visibility: "restricted"
      })
    });
    expect(createAccessResponse.status).toBe(201);

    const updateAccessResponse = await app.request("/access/acc-main", {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        availability: "available",
        visibility: "public"
      })
    });
    expect(updateAccessResponse.status).toBe(200);
    expect(await updateAccessResponse.json()).toMatchObject({
      accessId: "acc-main",
      availability: "available",
      visibility: "public"
    });

    const deleteAccessResponse = await app.request("/access/acc-main", { method: "DELETE", headers: authHeaders(token) });
    expect(deleteAccessResponse.status).toBe(204);

    const listAccessResponse = await app.request("/releases/rel-main/access", { headers: authHeaders(token) });
    const accessBody = await listAccessResponse.json() as { items: unknown[] };
    expect(accessBody.items).toEqual([]);

    const logs = await (await app.request("/audit-logs", { headers: authHeaders(token) })).json() as {
      items: Array<{ entityType: string; entityId: string; action: string }>;
    };
    expect(logs.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: "release", entityId: "rel-main", action: "update" }),
      expect.objectContaining({ entityType: "access_entry", entityId: "acc-main", action: "update" }),
      expect.objectContaining({ entityType: "access_entry", entityId: "acc-main", action: "delete" })
    ]));
  });

  it("deletes releases and cascades their access entries", async () => {
    const db = createMemoryDatabase();
    seedWork(db);
    const app = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);

    await app.request("/works/release-work/releases", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        releaseId: "rel-delete",
        audioTracks: [],
        subtitleTracks: [],
        releaseStatus: "published"
      })
    });
    await app.request("/releases/rel-delete/access", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        accessId: "acc-delete",
        accessType: "archive",
        visibility: "internal"
      })
    });

    const deleteReleaseResponse = await app.request("/releases/rel-delete", { method: "DELETE", headers: authHeaders(token) });
    expect(deleteReleaseResponse.status).toBe(204);

    const releases = await (await app.request("/works/release-work/releases", { headers: authHeaders(token) })).json() as { items: unknown[] };
    const access = await (await app.request("/releases/rel-delete/access", { headers: authHeaders(token) })).json() as { items: unknown[] };
    expect(releases.items).toEqual([]);
    expect(access.items).toEqual([]);

    const logs = await (await app.request("/audit-logs", { headers: authHeaders(token) })).json() as {
      items: Array<{ entityType: string; entityId: string; action: string }>;
    };
    expect(logs.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: "release", entityId: "rel-delete", action: "delete" })
    ]));
  });
});
