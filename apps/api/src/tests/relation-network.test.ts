import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createAdminApp } from "../routes/admin";
import { createPublicApp } from "../routes/public";
import { createWork } from "../services/works";
import type { RecordStatus, Visibility } from "@samdb/shared";
import { authHeaders, bootstrapOwnerToken, jsonHeaders } from "./authTestHelpers";

function seedWork(db: ReturnType<typeof createMemoryDatabase>, id: string, title: string, options: { series?: string | null; visibility?: Visibility; recordStatus?: RecordStatus } = {}) {
  createWork(db, {
    id,
    title,
    aliases: [],
    tags: [],
    series: options.series ?? null,
    summaryShort: `${title} summary.`,
    sourcePrimary: `https://example.test/${id}`,
    recordStatus: options.recordStatus ?? "published",
    visibility: options.visibility ?? "public"
  });
}

async function createRelation(admin: ReturnType<typeof createAdminApp>, token: string, sourceId: string, targetId: string, relationType: string, note: string | null = "Relation note") {
  const response = await admin.request(`/works/${sourceId}/relations`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({
      targetWorkId: targetId,
      relationType,
      direction: "directed",
      note,
      visibility: "public"
    })
  });
  expect(response.status).toBe(201);
}

describe("relation network", () => {
  it("derives reverse public relations and filters private targets", async () => {
    const db = createMemoryDatabase();
    seedWork(db, "work-a", "Work A");
    seedWork(db, "work-b", "Work B");
    seedWork(db, "private-work", "Private Work", { visibility: "internal" });
    const admin = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);
    await createRelation(admin, token, "work-a", "work-b", "prequel", "A comes before B");
    await createRelation(admin, token, "work-a", "private-work", "related", "Should not leak");

    const publicApp = createPublicApp(db);
    const response = await publicApp.request("/works/work-b/relation-network");
    const body = await response.json() as {
      groups: Array<{ group: string; items: Array<{ workId: string; title: string; relationType: string; reverse: boolean; label: string }> }>;
    };

    expect(response.status).toBe(200);
    expect(body.groups).toEqual([
      expect.objectContaining({
        group: "series",
        items: [
          expect.objectContaining({
            workId: "work-a",
            title: "Work A",
            relationType: "prequel",
            reverse: true,
            label: "前作"
          })
        ]
      })
    ]);

    const sourceResponse = await publicApp.request("/works/work-a/relation-network");
    const sourceBody = await sourceResponse.json() as { groups: Array<{ items: Array<{ workId: string }> }> };
    expect(sourceBody.groups.flatMap((group) => group.items).map((item) => item.workId)).toEqual(["work-b"]);
  });

  it("lists series summaries and details from series fields and relations", async () => {
    const db = createMemoryDatabase();
    seedWork(db, "series-a", "Series A", { series: "Star Line" });
    seedWork(db, "series-b", "Series B", { series: "Star Line" });
    seedWork(db, "series-c", "Series C");
    const admin = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);
    await createRelation(admin, token, "series-b", "series-c", "same_series", "Shared setting");

    const publicApp = createPublicApp(db);
    const list = await (await publicApp.request("/series")).json() as { items: Array<{ name: string; workCount: number }> };
    expect(list.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Star Line", workCount: 2 }),
      expect.objectContaining({ name: "Series B / Series C", workCount: 2 })
    ]));

    const detail = await (await publicApp.request("/series/Star%20Line")).json() as {
      name: string;
      works: Array<{ id: string; title: string }>;
    };
    expect(detail).toMatchObject({ name: "Star Line" });
    expect(detail.works.map((work) => work.id)).toEqual(["series-a", "series-b"]);

    const relationDetail = await publicApp.request("/series/Series%20B%20%2F%20Series%20C");
    expect(relationDetail.status).toBe(200);
    const relationBody = await relationDetail.json() as { works: Array<{ id: string }> };
    expect(relationBody.works.map((work) => work.id)).toEqual(["series-b", "series-c"]);
  });

  it("reports relation quality issues", async () => {
    const db = createMemoryDatabase();
    seedWork(db, "public-a", "Public A");
    seedWork(db, "public-b", "Public B");
    seedWork(db, "private-b", "Private B", { visibility: "internal" });
    const admin = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);
    await createRelation(admin, token, "public-a", "private-b", "related", "Leaks private target");
    await createRelation(admin, token, "public-a", "public-b", "related", null);
    await createRelation(admin, token, "public-b", "public-a", "prequel", "Conflict with sequel");
    await createRelation(admin, token, "public-a", "public-b", "sequel", "Conflict with prequel");

    const response = await admin.request("/relation-quality", { headers: authHeaders(token) });
    const body = await response.json() as { items: Array<{ issueType: string; relationId: number; message: string }> };

    expect(response.status).toBe(200);
    expect(body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ issueType: "public_to_private" }),
      expect.objectContaining({ issueType: "weak_relation_without_note" }),
      expect.objectContaining({ issueType: "direction_conflict" })
    ]));
  });
});
