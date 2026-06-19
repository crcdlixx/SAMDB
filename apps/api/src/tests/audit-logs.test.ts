import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createAdminApp } from "../routes/admin";
import { bootstrapOwnerToken, jsonHeaders, authHeaders } from "./authTestHelpers";

async function createWork(app: ReturnType<typeof createAdminApp>, token: string, id = "audit-work") {
  return app.request("/works", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({
      id,
      title: "Audit Work",
      aliases: [],
      tags: [],
      summaryShort: "A work used to verify audit logs.",
      sourcePrimary: "https://example.test/audit-work",
      recordStatus: "draft",
      visibility: "public"
    })
  });
}

describe("audit log admin routes", () => {
  it("records create and update actions for works", async () => {
    const db = createMemoryDatabase();
    const app = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);

    expect((await createWork(app, token)).status).toBe(201);
    const updateResponse = await app.request("/works/audit-work", {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ title: "Audit Work Updated" })
    });
    expect(updateResponse.status).toBe(200);

    const response = await app.request("/audit-logs", { headers: authHeaders(token) });
    const body = await response.json() as {
      items: Array<{
        entityType: string;
        entityId: string;
        action: string;
        actor: string | null;
        before: unknown;
        after: unknown;
      }>;
    };

    expect(response.status).toBe(200);
    const workItems = body.items.filter((item) => item.entityType === "work");
    expect(workItems).toHaveLength(2);
    expect(workItems.map((item) => item.action)).toEqual(["update", "create"]);
    expect(workItems[0]).toMatchObject({
      entityType: "work",
      entityId: "audit-work",
      action: "update",
      actor: "owner"
    });
    expect(workItems[0].before).toMatchObject({ title: "Audit Work" });
    expect(workItems[0].after).toMatchObject({ title: "Audit Work Updated" });
  });

  it("records destructive and classification/import actions", async () => {
    const db = createMemoryDatabase();
    const app = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);

    expect((await createWork(app, token, "audit-delete-work")).status).toBe(201);
    expect((await app.request("/works/audit-delete-work", { method: "DELETE", headers: authHeaders(token) })).status).toBe(204);

    const taxonomyResponse = await app.request("/taxonomies", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ id: "tax-audit", code: "audit", name: "Audit" })
    });
    expect(taxonomyResponse.status).toBe(201);

    const termResponse = await app.request("/taxonomies/audit/terms", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ id: "term-audit", taxonomyId: "tax-audit", label: "Audit Term", slug: "audit-term" })
    });
    expect(termResponse.status).toBe(201);

    expect((await createWork(app, token, "audit-taxonomy-work")).status).toBe(201);
    const attachResponse = await app.request("/works/audit-taxonomy-work/taxonomy-terms", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ termId: "term-audit", relationType: "tag" })
    });
    expect(attachResponse.status).toBe(201);
    const attached = await attachResponse.json() as { attached: { id: number } };
    expect((await app.request(`/work-taxonomy-terms/${attached.attached.id}`, { method: "DELETE", headers: authHeaders(token) })).status).toBe(204);

    const importResponse = await app.request("/import", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        markdown: `---
id: audit-import-work
title: Audit Import Work
summaryShort: Imported through audit test.
sourcePrimary: https://example.test/audit-import
recordStatus: published
visibility: public
---

# Audit Import Work
`
      })
    });
    expect(importResponse.status).toBe(201);

    const logs = await (await app.request("/audit-logs?limit=20", { headers: authHeaders(token) })).json() as {
      items: Array<{ entityType: string; entityId: string; action: string }>;
    };

    expect(logs.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: "work", entityId: "audit-delete-work", action: "delete" }),
      expect.objectContaining({ entityType: "taxonomy", entityId: "tax-audit", action: "create" }),
      expect.objectContaining({ entityType: "taxonomy_term", entityId: "term-audit", action: "create" }),
      expect.objectContaining({ entityType: "work_taxonomy_term", action: "create" }),
      expect.objectContaining({ entityType: "work_taxonomy_term", action: "delete" }),
      expect.objectContaining({ entityType: "work", entityId: "audit-import-work", action: "import" })
    ]));
  });
});
