import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createAccessEntry, listAccessEntriesForRelease, listPublicAccessEntriesForRelease } from "../services/accessEntries";
import { createRelease, listReleasesForWork } from "../services/releases";
import { createWork } from "../services/works";

function seedWork(db: ReturnType<typeof createMemoryDatabase>) {
  createWork(db, {
    id: "work-access",
    title: "访问测试作品",
    aliases: [],
    tags: [],
    summaryShort: "用于测试版本和获取方式。",
    sourcePrimary: "https://example.test/source",
    recordStatus: "published",
    visibility: "public"
  });
}

describe("releases and access entries", () => {
  it("creates releases and access entries for a work", () => {
    const db = createMemoryDatabase();
    seedWork(db);

    createRelease(db, {
      releaseId: "rel-work-access-v1",
      parentWorkId: "work-access",
      releaseTitle: "初版",
      releaseDate: "2026-06-07",
      audioTracks: [],
      subtitleTracks: [],
      releaseStatus: "published"
    });

    createAccessEntry(db, {
      accessId: "acc-work-access-official",
      parentReleaseId: "rel-work-access-v1",
      accessType: "official_streaming",
      platform: "Example Platform",
      url: "https://example.test/watch",
      availability: "可访问",
      accessNote: "公开页面",
      extractCode: "1234",
      internalPath: "D:/secret/work-access",
      visibility: "restricted"
    });

    expect(listReleasesForWork(db, "work-access")).toHaveLength(1);
    expect(listAccessEntriesForRelease(db, "rel-work-access-v1")).toHaveLength(1);
  });

  it("filters internal fields for public access entries", () => {
    const db = createMemoryDatabase();
    seedWork(db);

    createRelease(db, {
      releaseId: "rel-work-access-v1",
      parentWorkId: "work-access",
      audioTracks: [],
      subtitleTracks: [],
      releaseStatus: "published"
    });

    createAccessEntry(db, {
      accessId: "acc-work-access-official",
      parentReleaseId: "rel-work-access-v1",
      accessType: "official_streaming",
      platform: "Example Platform",
      url: "https://example.test/watch",
      availability: "可访问",
      mirrorNote: "restricted mirror",
      accessRisk: "restricted risk",
      checksum: "sha256-secret",
      extractCode: "1234",
      internalPath: "D:/secret/work-access",
      sensitiveSource: "private source",
      visibility: "restricted"
    });

    const [entry] = listPublicAccessEntriesForRelease(db, "rel-work-access-v1");

    expect(entry).toMatchObject({
      accessId: "acc-work-access-official",
      accessType: "official_streaming",
      platform: "Example Platform"
    });
    expect(entry).not.toHaveProperty("extractCode");
    expect(entry).not.toHaveProperty("internalPath");
    expect(entry).not.toHaveProperty("checksum");
    expect(entry).not.toHaveProperty("sensitiveSource");
  });
});
