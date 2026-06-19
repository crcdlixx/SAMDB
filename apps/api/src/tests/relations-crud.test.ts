import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createAdminApp } from "../routes/admin";
import { createWork } from "../services/works";
import { authHeaders, bootstrapOwnerToken, jsonHeaders } from "./authTestHelpers";

function seedWorks(db: ReturnType<typeof createMemoryDatabase>) {
  createWork(db, {
    id: "source-work",
    title: "Source Work",
    aliases: [],
    tags: [],
    summaryShort: "Source summary",
    sourcePrimary: "https://example.test/source",
    recordStatus: "published",
    visibility: "public"
  });
  createWork(db, {
    id: "target-work",
    title: "Target Work",
    aliases: [],
    tags: [],
    summaryShort: "Target summary",
    sourcePrimary: "https://example.test/target",
    recordStatus: "published",
    visibility: "public"
  });
}

describe("work relation admin CRUD", () => {
  it("updates and deletes work relations with audit logs", async () => {
    const db = createMemoryDatabase();
    seedWorks(db);
    const app = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);

    const createResponse = await app.request("/works/source-work/relations", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        targetWorkId: "target-work",
        relationType: "related",
        direction: "bidirectional",
        note: "Initial note",
        visibility: "public"
      })
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { relation: { id: number } };

    const updateResponse = await app.request(`/relations/${created.relation.id}`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        relationType: "same_series",
        note: "Updated note",
        visibility: "internal"
      })
    });
    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toMatchObject({
      id: created.relation.id,
      relation_type: "same_series",
      note: "Updated note",
      visibility: "internal"
    });

    const deleteResponse = await app.request(`/relations/${created.relation.id}`, { method: "DELETE", headers: authHeaders(token) });
    expect(deleteResponse.status).toBe(204);

    const relations = await (await app.request("/works/source-work/relations", { headers: authHeaders(token) })).json() as { items: unknown[] };
    const logs = await (await app.request("/audit-logs", { headers: authHeaders(token) })).json() as {
      items: Array<{ entityType: string; entityId: string; action: string }>;
    };

    expect(relations.items).toEqual([]);
    expect(logs.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: "work_relation", entityId: String(created.relation.id), action: "create" }),
      expect.objectContaining({ entityType: "work_relation", entityId: String(created.relation.id), action: "update" }),
      expect.objectContaining({ entityType: "work_relation", entityId: String(created.relation.id), action: "delete" })
    ]));
  });
});
