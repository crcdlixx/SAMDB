import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createPublicApp } from "../routes/public";
import { createAccessEntry } from "../services/accessEntries";
import { createContributor } from "../services/contributors";
import { createWorkRelation } from "../services/relations";
import { createRelease } from "../services/releases";
import { createWork } from "../services/works";

describe("public routes", () => {
  it("serves public works", async () => {
    const db = createMemoryDatabase();
    createWork(db, {
      id: "public-work",
      title: "公开作品",
      aliases: [],
      tags: [],
      summaryShort: "公开简介",
      sourcePrimary: "https://example.test/source",
      recordStatus: "published",
      visibility: "public"
    });

    const app = createPublicApp(db);
    const response = await app.request("/works");
    const body = await response.json() as { items: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.items[0]?.id).toBe("public-work");
  });

  it("does not list draft works in public API", async () => {
    const db = createMemoryDatabase();
    createWork(db, {
      id: "draft-work",
      title: "草稿作品",
      aliases: [],
      tags: [],
      summaryShort: "草稿简介",
      sourcePrimary: "https://example.test/source",
      recordStatus: "draft",
      visibility: "public"
    });

    const app = createPublicApp(db);
    const response = await app.request("/works");
    const body = await response.json() as { items: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(0);
  });

  it("searches public works by contributor name and tags", async () => {
    const db = createMemoryDatabase();
    createWork(db, {
      id: "search-work",
      title: "Searchable Work",
      aliases: [],
      tags: ["星图主题"],
      summaryShort: "Searchable summary",
      sourcePrimary: "https://example.test/source",
      recordStatus: "published",
      visibility: "public"
    });
    createWork(db, {
      id: "other-work",
      title: "Other Work",
      aliases: [],
      tags: [],
      summaryShort: "Other summary",
      sourcePrimary: "https://example.test/other",
      recordStatus: "published",
      visibility: "public"
    });
    createContributor(db, {
      workId: "search-work",
      name: "检索作者",
      role: "author",
      visibility: "public"
    });

    const app = createPublicApp(db);
    const byContributor = await (await app.request("/works?q=检索作者")).json() as { items: Array<{ id: string }> };
    const byTag = await (await app.request("/works?q=星图主题")).json() as { items: Array<{ id: string }> };

    expect(byContributor.items.map((work) => work.id)).toEqual(["search-work"]);
    expect(byTag.items.map((work) => work.id)).toEqual(["search-work"]);
  });

  it("does not leak internal access fields on public work detail", async () => {
    const db = createMemoryDatabase();
    createWork(db, {
      id: "public-work",
      title: "公开作品",
      aliases: [],
      tags: [],
      summaryShort: "公开简介",
      sourcePrimary: "https://example.test/source",
      recordStatus: "published",
      visibility: "public"
    });
    createRelease(db, {
      releaseId: "rel-public-work",
      parentWorkId: "public-work",
      audioTracks: [],
      subtitleTracks: [],
      releaseStatus: "published"
    });
    createAccessEntry(db, {
      accessId: "acc-public-work",
      parentReleaseId: "rel-public-work",
      accessType: "official_streaming",
      platform: "Example",
      extractCode: "1234",
      internalPath: "D:/secret",
      sensitiveSource: "private",
      visibility: "restricted"
    });

    const app = createPublicApp(db);
    const response = await app.request("/works/public-work");
    const body = await response.json() as {
      releases: Array<{ accessEntries: Array<Record<string, unknown>> }>;
    };

    expect(response.status).toBe(200);
    expect(body.releases[0]?.accessEntries[0]).toMatchObject({
      accessId: "acc-public-work",
      accessType: "official_streaming",
      platform: "Example"
    });
    expect(body.releases[0]?.accessEntries[0]).not.toHaveProperty("extractCode");
    expect(body.releases[0]?.accessEntries[0]).not.toHaveProperty("internalPath");
    expect(body.releases[0]?.accessEntries[0]).not.toHaveProperty("sensitiveSource");
    expect(body.releases[0]?.accessEntries[0]).not.toHaveProperty("visibility");
    expect(body.releases[0]?.accessEntries[0]).not.toHaveProperty("createdAt");
    expect(body.releases[0]?.accessEntries[0]).not.toHaveProperty("updatedAt");
  });

  it("does not expose draft releases on public work detail", async () => {
    const db = createMemoryDatabase();
    createWork(db, {
      id: "public-work",
      title: "Public Work",
      aliases: [],
      tags: [],
      summaryShort: "Public summary",
      sourcePrimary: "https://example.test/source",
      recordStatus: "published",
      visibility: "public"
    });
    createRelease(db, {
      releaseId: "rel-draft",
      parentWorkId: "public-work",
      releaseTitle: "Draft Release",
      audioTracks: [],
      subtitleTracks: [],
      releaseStatus: "draft"
    });
    createRelease(db, {
      releaseId: "rel-published",
      parentWorkId: "public-work",
      releaseTitle: "Published Release",
      audioTracks: [],
      subtitleTracks: [],
      releaseStatus: "published"
    });

    const app = createPublicApp(db);
    const response = await app.request("/works/public-work");
    const body = await response.json() as {
      releases: Array<{ releaseId: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.releases.map((release) => release.releaseId)).toEqual(["rel-published"]);
  });

  it("does not expose internal relations on public relation routes", async () => {
    const db = createMemoryDatabase();
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
      id: "public-target",
      title: "Public Target",
      aliases: [],
      tags: [],
      summaryShort: "Public target",
      sourcePrimary: "https://example.test/public-target",
      recordStatus: "published",
      visibility: "public"
    });
    createWork(db, {
      id: "internal-target",
      title: "Internal Target",
      aliases: [],
      tags: [],
      summaryShort: "Internal target",
      sourcePrimary: "https://example.test/internal-target",
      recordStatus: "published",
      visibility: "internal"
    });
    createWorkRelation(db, {
      sourceWorkId: "source-work",
      targetWorkId: "public-target",
      relationType: "related",
      direction: "bidirectional",
      confidence: "manual",
      visibility: "public"
    });
    createWorkRelation(db, {
      sourceWorkId: "source-work",
      targetWorkId: "internal-target",
      relationType: "related",
      direction: "bidirectional",
      confidence: "manual",
      visibility: "internal"
    });

    const app = createPublicApp(db);
    const response = await app.request("/works/source-work/relations");
    const body = await response.json() as {
      items: Array<{ target_work_id: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.items.map((relation) => relation.target_work_id)).toEqual(["public-target"]);
  });
});
