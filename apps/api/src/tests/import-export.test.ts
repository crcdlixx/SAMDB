import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createAccessEntry } from "../services/accessEntries";
import { exportWorksToMarkdown, importWorkFromMarkdown } from "../services/importExport";
import { createWorkRelation } from "../services/relations";
import { createRelease } from "../services/releases";
import { createTaxonomy, createTerm } from "../services/taxonomies";
import { attachTermToWork } from "../services/workTaxonomyTerms";
import { createWork, getWorkById } from "../services/works";

let tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "samdb-export-"));
  tempDirs.push(dir);
  return dir;
}

describe("import/export", () => {
  it("exports works with releases, access entries, taxonomy terms, and relations", () => {
    const db = createMemoryDatabase();
    createWork(db, {
      id: "export-work",
      title: "导出作品",
      aliases: ["Export Work"],
      tags: ["tag-a"],
      summaryShort: "用于测试完整导出。",
      sourcePrimary: "https://example.test/export",
      recordStatus: "published",
      visibility: "public"
    });
    createWork(db, {
      id: "export-related",
      title: "导出关联作品",
      aliases: [],
      tags: [],
      summaryShort: "用于测试关系导出。",
      sourcePrimary: "https://example.test/related",
      recordStatus: "published",
      visibility: "public"
    });
    createRelease(db, {
      releaseId: "rel-export-work",
      parentWorkId: "export-work",
      releaseTitle: "导出版",
      audioTracks: [],
      subtitleTracks: [],
      releaseStatus: "published"
    });
    createAccessEntry(db, {
      accessId: "acc-export-work",
      parentReleaseId: "rel-export-work",
      accessType: "official_streaming",
      platform: "Example",
      extractCode: "1234",
      visibility: "restricted"
    });
    createTaxonomy(db, { id: "tax-export-theme", code: "theme", name: "题材" });
    createTerm(db, { id: "term-export-theme", taxonomyId: "tax-export-theme", label: "导出题材", slug: "export-theme" });
    attachTermToWork(db, { workId: "export-work", termId: "term-export-theme", relationType: "theme" });
    createWorkRelation(db, {
      sourceWorkId: "export-work",
      targetWorkId: "export-related",
      relationType: "related",
      direction: "bidirectional",
      confidence: "manual",
      visibility: "public"
    });

    const outputDir = makeTempDir();
    const files = exportWorksToMarkdown(db, outputDir);
    const file = files.find((item) => item.endsWith("export-work.md"));
    expect(file).toBeTruthy();
    const content = readFileSync(file!, "utf8");
    const frontmatter = content.split("---\n")[1];
    const data = YAML.parse(frontmatter);

    expect(data.id).toBe("export-work");
    expect(data.releases).toHaveLength(1);
    expect(data.releases[0].accessEntries).toHaveLength(1);
    expect(data.taxonomyTerms[0]).toMatchObject({ label: "导出题材", taxonomy_code: "theme" });
    expect(data.relations[0]).toMatchObject({ target_title: "导出关联作品", relation_type: "related" });
  });

  it("imports a work from Markdown frontmatter", () => {
    const db = createMemoryDatabase();
    const markdown = `---
id: imported-work
title: 导入作品
aliases:
  - Imported Work
tags:
  - imported
summaryShort: 用于测试导入。
sourcePrimary: https://example.test/imported
recordStatus: published
visibility: public
---

# 导入作品
`;

    const imported = importWorkFromMarkdown(db, markdown);

    expect(imported.id).toBe("imported-work");
    expect(getWorkById(db, "imported-work")?.title).toBe("导入作品");
  });
});
