import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createAdminApp } from "../routes/admin";
import { createPublicApp } from "../routes/public";
import { createWork } from "../services/works";
import { authHeaders, bootstrapOwnerToken, jsonHeaders } from "./authTestHelpers";

function seedPublishedWork(db: ReturnType<typeof createMemoryDatabase>) {
  createWork(db, {
    id: "evidence-work",
    title: "Evidence Work",
    aliases: [],
    tags: [],
    summaryShort: "A work with sources and external links.",
    sourcePrimary: "https://example.test/primary",
    recordStatus: "published",
    visibility: "public"
  });
}

describe("sources and external links", () => {
  it("creates admin sources and external links, then exposes only public entries", async () => {
    const db = createMemoryDatabase();
    seedPublishedWork(db);
    const adminApp = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);

    const sourceResponse = await adminApp.request("/works/evidence-work/sources", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        sourceType: "official",
        url: "https://example.test/source",
        title: "Official source",
        evidenceLevel: "primary",
        note: "Public evidence",
        visibility: "public"
      })
    });
    expect(sourceResponse.status).toBe(201);

    const internalSourceResponse = await adminApp.request("/works/evidence-work/sources", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        sourceType: "note",
        title: "Private note",
        note: "Internal research",
        visibility: "internal"
      })
    });
    expect(internalSourceResponse.status).toBe(201);

    const linkResponse = await adminApp.request("/works/evidence-work/external-links", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        targetType: "official_site",
        title: "Official site",
        url: "https://example.test/official",
        relationType: "homepage",
        visibility: "public"
      })
    });
    expect(linkResponse.status).toBe(201);

    const adminSources = await (await adminApp.request("/works/evidence-work/sources", { headers: authHeaders(token) })).json() as { items: unknown[] };
    const adminLinks = await (await adminApp.request("/works/evidence-work/external-links", { headers: authHeaders(token) })).json() as { items: unknown[] };
    expect(adminSources.items).toHaveLength(2);
    expect(adminLinks.items).toHaveLength(1);

    const publicApp = createPublicApp(db);
    const publicWork = await (await publicApp.request("/works/evidence-work")).json() as {
      sources: Array<{ title: string }>;
      externalLinks: Array<{ title: string }>;
    };

    expect(publicWork.sources).toEqual([
      expect.objectContaining({ title: "Official source" })
    ]);
    expect(publicWork.externalLinks).toEqual([
      expect.objectContaining({ title: "Official site" })
    ]);
  });

  it("updates and deletes sources and external links with audit logs", async () => {
    const db = createMemoryDatabase();
    seedPublishedWork(db);
    const adminApp = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);

    const source = await (await adminApp.request("/works/evidence-work/sources", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        sourceType: "official",
        title: "Original source",
        url: "https://example.test/source",
        visibility: "public"
      })
    })).json() as { id: number };

    const updateSourceResponse = await adminApp.request(`/sources/${source.id}`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        title: "Updated source",
        visibility: "internal"
      })
    });
    expect(updateSourceResponse.status).toBe(200);
    expect(await updateSourceResponse.json()).toMatchObject({
      id: source.id,
      title: "Updated source",
      visibility: "internal"
    });

    const link = await (await adminApp.request("/works/evidence-work/external-links", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        targetType: "official_site",
        title: "Link to delete",
        url: "https://example.test/delete",
        visibility: "public"
      })
    })).json() as { id: number };

    const updateLinkResponse = await adminApp.request(`/external-links/${link.id}`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        title: "Updated link",
        visibility: "internal"
      })
    });
    expect(updateLinkResponse.status).toBe(200);

    const deleteLinkResponse = await adminApp.request(`/external-links/${link.id}`, { method: "DELETE", headers: authHeaders(token) });
    expect(deleteLinkResponse.status).toBe(204);

    const sources = await (await adminApp.request("/works/evidence-work/sources", { headers: authHeaders(token) })).json() as {
      items: Array<{ title: string; visibility: string }>;
    };
    const links = await (await adminApp.request("/works/evidence-work/external-links", { headers: authHeaders(token) })).json() as {
      items: unknown[];
    };
    const logs = await (await adminApp.request("/audit-logs", { headers: authHeaders(token) })).json() as {
      items: Array<{ entityType: string; entityId: string; action: string }>;
    };

    expect(sources.items).toEqual([
      expect.objectContaining({ title: "Updated source", visibility: "internal" })
    ]);
    expect(links.items).toEqual([]);
    expect(logs.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: "source", entityId: String(source.id), action: "update" }),
      expect.objectContaining({ entityType: "external_link", entityId: String(link.id), action: "update" }),
      expect.objectContaining({ entityType: "external_link", entityId: String(link.id), action: "delete" })
    ]));
  });
});
