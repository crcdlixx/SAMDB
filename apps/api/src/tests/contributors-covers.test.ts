import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createAdminApp } from "../routes/admin";
import { createPublicApp } from "../routes/public";
import { createWork } from "../services/works";
import { authHeaders, bootstrapOwnerToken, jsonHeaders } from "./authTestHelpers";

function seedPublishedWork(db: ReturnType<typeof createMemoryDatabase>) {
  createWork(db, {
    id: "credit-work",
    title: "Credit Work",
    aliases: [],
    tags: [],
    summaryShort: "A work with contributors and covers.",
    sourcePrimary: "https://example.test/credit-work",
    recordStatus: "published",
    visibility: "public"
  });
}

describe("contributors and covers", () => {
  it("creates admin contributors and covers, then exposes only public entries", async () => {
    const db = createMemoryDatabase();
    seedPublishedWork(db);
    const adminApp = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);

    const contributorResponse = await adminApp.request("/works/credit-work/contributors", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        name: "Lead Artist",
        role: "artist",
        creditName: "L. Artist",
        note: "Public credit",
        visibility: "public"
      })
    });
    expect(contributorResponse.status).toBe(201);

    const internalContributorResponse = await adminApp.request("/works/credit-work/contributors", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        name: "Internal Reviewer",
        role: "reviewer",
        visibility: "internal"
      })
    });
    expect(internalContributorResponse.status).toBe(201);

    const coverResponse = await adminApp.request("/works/credit-work/covers", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        id: "cover-credit-work-main",
        url: "/assets/covers/credit-work-main.jpg",
        source: "local",
        isPrimary: true,
        processNote: "Cropped for display",
        visibility: "public"
      })
    });
    expect(coverResponse.status).toBe(201);

    const internalCoverResponse = await adminApp.request("/works/credit-work/covers", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        id: "cover-credit-work-internal",
        url: "/assets/covers/credit-work-internal.jpg",
        source: "local",
        visibility: "internal"
      })
    });
    expect(internalCoverResponse.status).toBe(201);

    const adminContributors = await (await adminApp.request("/works/credit-work/contributors", { headers: authHeaders(token) })).json() as { items: unknown[] };
    const adminCovers = await (await adminApp.request("/works/credit-work/covers", { headers: authHeaders(token) })).json() as { items: unknown[] };
    expect(adminContributors.items).toHaveLength(2);
    expect(adminCovers.items).toHaveLength(2);

    const publicApp = createPublicApp(db);
    const publicWork = await (await publicApp.request("/works/credit-work")).json() as {
      contributors: Array<{ name: string; role: string }>;
      covers: Array<{ id: string; url: string }>;
    };

    expect(publicWork.contributors).toEqual([
      expect.objectContaining({ name: "Lead Artist", role: "artist" })
    ]);
    expect(publicWork.covers).toEqual([
      expect.objectContaining({ id: "cover-credit-work-main", url: "/assets/covers/credit-work-main.jpg" })
    ]);
  });

  it("updates contributors and deletes covers with audit logs", async () => {
    const db = createMemoryDatabase();
    seedPublishedWork(db);
    const adminApp = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);

    const contributor = await (await adminApp.request("/works/credit-work/contributors", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        name: "Original Name",
        role: "artist",
        visibility: "public"
      })
    })).json() as { id: number };

    const updateResponse = await adminApp.request(`/contributors/${contributor.id}`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        name: "Updated Name",
        role: "director"
      })
    });
    expect(updateResponse.status).toBe(200);

    await adminApp.request("/works/credit-work/covers", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        id: "cover-to-delete",
        url: "/assets/covers/delete-me.jpg",
        visibility: "public"
      })
    });

    const deleteResponse = await adminApp.request("/covers/cover-to-delete", { method: "DELETE", headers: authHeaders(token) });
    expect(deleteResponse.status).toBe(204);

    const contributors = await (await adminApp.request("/works/credit-work/contributors", { headers: authHeaders(token) })).json() as {
      items: Array<{ name: string; role: string }>;
    };
    const covers = await (await adminApp.request("/works/credit-work/covers", { headers: authHeaders(token) })).json() as {
      items: Array<{ id: string }>;
    };
    const logs = await (await adminApp.request("/audit-logs", { headers: authHeaders(token) })).json() as {
      items: Array<{ entityType: string; entityId: string; action: string }>;
    };

    expect(contributors.items[0]).toMatchObject({ name: "Updated Name", role: "director" });
    expect(covers.items).toEqual([]);
    expect(logs.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: "contributor", entityId: String(contributor.id), action: "update" }),
      expect.objectContaining({ entityType: "cover", entityId: "cover-to-delete", action: "delete" })
    ]));
  });
});
