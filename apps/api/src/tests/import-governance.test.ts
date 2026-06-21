import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase, initializeDatabase, type SamDb } from "../db";
import { createAdminApp } from "../routes/admin";
import { createWork } from "../services/works";
import { bootstrapOwnerToken, createEditorToken, jsonHeaders } from "./authTestHelpers";
import { createAuthApp } from "../routes/auth";

function createTempDatabase(): { db: SamDb; path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "samdb-import-test-"));
  const path = join(dir, "test.sqlite");
  const db = createDatabase(path);
  initializeDatabase(db);
  return {
    db,
    path,
    cleanup: () => {
      try {
        (db as SamDb & { close?: () => void }).close?.();
      } catch {
        // ignore close errors in tests
      }
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Windows may keep sqlite handles briefly
      }
    }
  };
}

async function createRoleToken(
  db: SamDb,
  admin: ReturnType<typeof createAdminApp>,
  ownerToken: string,
  username: string,
  role: string
): Promise<string> {
  await admin.request("/users", {
    method: "POST",
    headers: jsonHeaders(ownerToken),
    body: JSON.stringify({
      username,
      password: `${username}-password`,
      role
    })
  });
  const auth = createAuthApp(db);
  const login = await auth.request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: `${username}-password` })
  });
  const body = await login.json() as { token: string };
  return body.token;
}

describe("import governance", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  it("preview parses multiple markdown blocks without writing works", async () => {
    const { db, path, cleanup } = createTempDatabase();
    cleanups.push(cleanup);
    const app = createAdminApp(db, { databasePath: path });
    const token = await bootstrapOwnerToken(db);

    createWork(db, {
      id: "existing-work",
      title: "已有作品",
      aliases: [],
      tags: [],
      summaryShort: "existing",
      sourcePrimary: "https://example.test/existing",
      recordStatus: "draft",
      visibility: "public"
    });

    const markdown = `---
id: brand-new-work
title: 全新作品
summaryShort: 新作品摘要
sourcePrimary: https://example.test/brand-new
recordStatus: draft
visibility: public
---

# 全新作品

---
id: existing-work
title: 重复 ID
summaryShort: 重复
sourcePrimary: https://example.test/dup
recordStatus: draft
visibility: public
---

# 重复 ID

---
title: 缺字段作品
summaryShort: 只有标题和摘要
sourcePrimary: https://example.test/missing
recordStatus: draft
visibility: public
---
`;

    const response = await app.request("/import-jobs/preview", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ sourceType: "markdown", markdown })
    });
    const job = await response.json() as {
      id: string;
      status: string;
      candidates: Array<{ proposedWorkId: string | null; proposedTitle: string | null; status: string; action: string; issues: Array<{ severity: string }>; matches: Array<{ matchType: string }> }>;
    };

    expect(response.status).toBe(201);
    expect(job.candidates).toHaveLength(3);
    expect(job.status).toBe("needs_review");

    const newWork = job.candidates.find((c) => c.proposedWorkId === "brand-new-work");
    expect(newWork?.action).toBe("create");

    const duplicate = job.candidates.find((c) => c.proposedWorkId === "existing-work");
    expect(duplicate?.matches.some((m) => m.matchType === "id_exact")).toBe(true);
    expect(duplicate?.action).toBe("needs_review");

    const autoId = job.candidates.find((c) => c.proposedTitle === "缺字段作品");
    expect(autoId?.proposedWorkId).toBeNull();
    expect(autoId?.action).toBe("create");
    expect(autoId?.issues.some((i) => i.severity === "error")).toBe(false);

    const works = db.prepare("SELECT COUNT(*) as count FROM works").get() as { count: number };
    expect(works.count).toBe(1);
  });

  it("creates invalid candidate for yaml errors", async () => {
    const { db, path, cleanup } = createTempDatabase();
    cleanups.push(cleanup);
    const app = createAdminApp(db, { databasePath: path });
    const token = await bootstrapOwnerToken(db);

    const markdown = `---
id: [broken
title: bad yaml
---
`;

    const response = await app.request("/import-jobs/preview", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ sourceType: "markdown", markdown })
    });
    const job = await response.json() as { candidates: Array<{ status: string; issues: Array<{ issueType: string }> }> };

    expect(response.status).toBe(201);
    expect(job.candidates[0].status).toBe("invalid");
    expect(job.candidates[0].issues.some((i) => i.issueType === "parse_error")).toBe(true);
  });

  it("executes create/skip/overwrite/merge with backup", async () => {
    const { db, path, cleanup } = createTempDatabase();
    cleanups.push(cleanup);
    const app = createAdminApp(db, { databasePath: path });
    const token = await bootstrapOwnerToken(db);

    createWork(db, {
      id: "merge-target",
      title: "合并目标",
      aliases: [],
      tags: ["old"],
      summaryShort: "old summary",
      summaryFull: null,
      sourcePrimary: "https://example.test/merge-target",
      recordStatus: "draft",
      visibility: "public"
    });

    createWork(db, {
      id: "overwrite-target",
      title: "覆盖目标",
      aliases: [],
      tags: [],
      summaryShort: "to be overwritten",
      sourcePrimary: "https://example.test/overwrite-target",
      recordStatus: "draft",
      visibility: "public"
    });

    const markdown = `---
id: exec-create
title: 执行创建
summaryShort: create action
sourcePrimary: https://example.test/exec-create
recordStatus: draft
visibility: public
---

---
id: exec-skip
title: 执行跳过
summaryShort: skip action
sourcePrimary: https://example.test/exec-skip
recordStatus: draft
visibility: public
---

---
id: exec-overwrite
title: 执行覆盖
summaryShort: overwrite action
sourcePrimary: https://example.test/exec-overwrite-new
recordStatus: draft
visibility: public
---

---
id: exec-merge
title: 执行合并
aliases: [Merged Alias]
tags: [new-tag]
summaryShort: merge action
summaryFull: full summary from candidate
sourcePrimary: https://example.test/exec-merge
recordStatus: draft
visibility: public
---
`;

    const preview = await app.request("/import-jobs/preview", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ sourceType: "markdown", markdown })
    });
    const job = await preview.json() as {
      id: string;
      candidates: Array<{ id: string; proposedWorkId: string | null; action: string }>;
    };

    const skipCandidate = job.candidates.find((c) => c.proposedWorkId === "exec-skip")!;
    const overwriteCandidate = job.candidates.find((c) => c.proposedWorkId === "exec-overwrite")!;
    const mergeCandidate = job.candidates.find((c) => c.proposedWorkId === "exec-merge")!;

    await app.request(`/import-candidates/${skipCandidate.id}`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ action: "skip" })
    });
    await app.request(`/import-candidates/${overwriteCandidate.id}`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ action: "overwrite", targetWorkId: "overwrite-target" })
    });
    await app.request(`/import-candidates/${mergeCandidate.id}`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ action: "merge", targetWorkId: "merge-target" })
    });

    const execute = await app.request(`/import-jobs/${job.id}/execute`, {
      method: "POST",
      headers: jsonHeaders(token)
    });
    const executed = await execute.json() as {
      status: string;
      summary: { backupFile?: string; successCount?: number };
      candidates: Array<{ proposedWorkId: string | null; status: string }>;
    };

    expect(execute.status).toBe(200);
    expect(executed.status).toBe("completed");
    expect(executed.summary.backupFile).toBeTruthy();

    const created = db.prepare("SELECT * FROM works WHERE id = 'exec-create'").get();
    expect(created).toBeTruthy();

    const skipped = executed.candidates.find((c) => c.proposedWorkId === "exec-skip");
    expect(skipped?.status).toBe("skipped");
    expect(db.prepare("SELECT * FROM works WHERE id = 'exec-skip'").get()).toBeUndefined();

    const overwritten = db.prepare("SELECT title, source_primary FROM works WHERE id = 'overwrite-target'").get() as {
      title: string;
      source_primary: string;
    };
    expect(overwritten.title).toBe("执行覆盖");
    expect(overwritten.source_primary).toBe("https://example.test/exec-overwrite-new");

    const merged = db.prepare("SELECT aliases_json, tags_json, summary_full FROM works WHERE id = 'merge-target'").get() as {
      aliases_json: string;
      tags_json: string;
      summary_full: string | null;
    };
    expect(JSON.parse(merged.aliases_json)).toContain("Merged Alias");
    expect(JSON.parse(merged.tags_json)).toEqual(expect.arrayContaining(["old", "new-tag"]));
    expect(merged.summary_full).toBe("full summary from candidate");
  });

  it("generates uuid ids when importing candidates without ids", async () => {
    const { db, path, cleanup } = createTempDatabase();
    cleanups.push(cleanup);
    const app = createAdminApp(db, { databasePath: path });
    const token = await bootstrapOwnerToken(db);

    const preview = await app.request("/import-jobs/preview", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        sourceType: "markdown",
        markdown: `---\ntitle: Auto ID Work\nsummaryShort: x\nsourcePrimary: https://example.test/auto-id\nrecordStatus: draft\nvisibility: public\n---\n`
      })
    });
    const job = await preview.json() as {
      id: string;
      candidates: Array<{ proposedWorkId: string | null; action: string; status: string; issues: Array<{ severity: string }> }>;
    };

    expect(job.candidates[0].proposedWorkId).toBeNull();
    expect(job.candidates[0].action).toBe("create");
    expect(job.candidates[0].status).toBe("valid");
    expect(job.candidates[0].issues.some((issue) => issue.severity === "error")).toBe(false);

    const execute = await app.request(`/import-jobs/${job.id}/execute`, {
      method: "POST",
      headers: jsonHeaders(token)
    });
    const executed = await execute.json() as {
      candidates: Array<{ resultWorkId: string | null; status: string }>;
    };

    expect(execute.status).toBe(200);
    expect(executed.candidates[0].status).toBe("imported");
    expect(executed.candidates[0].resultWorkId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(db.prepare("SELECT id FROM works WHERE source_primary = ?").get("https://example.test/auto-id")).toEqual({
      id: executed.candidates[0].resultWorkId
    });
  });

  it("rejects execute when needs_review remains", async () => {
    const { db, path, cleanup } = createTempDatabase();
    cleanups.push(cleanup);
    const app = createAdminApp(db, { databasePath: path });
    const token = await bootstrapOwnerToken(db);

    const preview = await app.request("/import-jobs/preview", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        sourceType: "markdown",
        markdown: `---\nsummaryShort: x\nsourcePrimary: https://example.test/x\nrecordStatus: draft\nvisibility: public\n---\n`
      })
    });
    const job = await preview.json() as { id: string };

    const execute = await app.request(`/import-jobs/${job.id}/execute`, {
      method: "POST",
      headers: jsonHeaders(token)
    });
    expect(execute.status).toBe(409);
  });

  it("viewer cannot execute import", async () => {
    const { db, path, cleanup } = createTempDatabase();
    cleanups.push(cleanup);
    const app = createAdminApp(db, { databasePath: path });
    const ownerToken = await bootstrapOwnerToken(db);
    const viewerToken = await createRoleToken(db, app, ownerToken, "viewer", "viewer");

    const preview = await app.request("/import-jobs/preview", {
      method: "POST",
      headers: jsonHeaders(ownerToken),
      body: JSON.stringify({
        sourceType: "markdown",
        markdown: `---\nid: viewer-test\ntitle: Viewer Test\nsummaryShort: x\nsourcePrimary: https://example.test/v\nrecordStatus: draft\nvisibility: public\n---\n`
      })
    });
    expect(preview.status).toBe(201);
    const job = await preview.json() as { id: string; candidates: Array<{ id: string }> };

    await app.request(`/import-candidates/${job.candidates[0].id}`, {
      method: "PATCH",
      headers: jsonHeaders(ownerToken),
      body: JSON.stringify({ action: "create" })
    });

    const execute = await app.request(`/import-jobs/${job.id}/execute`, {
      method: "POST",
      headers: jsonHeaders(viewerToken)
    });
    expect(execute.status).toBe(403);
  });

  it("records audit logs for preview and execute", async () => {
    const { db, path, cleanup } = createTempDatabase();
    cleanups.push(cleanup);
    const app = createAdminApp(db, { databasePath: path });
    const token = await bootstrapOwnerToken(db);

    const preview = await app.request("/import-jobs/preview", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        sourceType: "markdown",
        markdown: `---\nid: audit-work\ntitle: Audit Work\nsummaryShort: audit\nsourcePrimary: https://example.test/audit\nrecordStatus: draft\nvisibility: public\n---\n`
      })
    });
    const job = await preview.json() as { id: string; candidates: Array<{ id: string }> };

    await app.request(`/import-candidates/${job.candidates[0].id}`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ action: "create" })
    });

    await app.request(`/import-jobs/${job.id}/execute`, {
      method: "POST",
      headers: jsonHeaders(token)
    });

    const logs = db.prepare("SELECT action, actor FROM audit_logs ORDER BY id ASC").all() as Array<{ action: string; actor: string | null }>;
    expect(logs.some((l) => l.action === "preview" && l.actor === "owner")).toBe(true);
    expect(logs.some((l) => l.action === "execute" && l.actor === "owner")).toBe(true);
    expect(logs.some((l) => l.action === "import_create")).toBe(true);
  });

  it("detects title, alias, source and external url duplicates", async () => {
    const { db, path, cleanup } = createTempDatabase();
    cleanups.push(cleanup);
    const app = createAdminApp(db, { databasePath: path });
    const token = await bootstrapOwnerToken(db);

    createWork(db, {
      id: "dup-source",
      title: "Source Match",
      aliases: ["Alias Target"],
      tags: [],
      summaryShort: "s",
      sourcePrimary: "https://example.test/shared-source",
      recordStatus: "draft",
      visibility: "public"
    });

    db.prepare(`
      INSERT INTO external_links (work_id, target_type, url, visibility, created_at, updated_at)
      VALUES ('dup-source', 'reference', 'https://example.test/shared-url', 'public', datetime('now'), datetime('now'))
    `).run();

    const markdown = `---
id: candidate-1
title: Source Match
summaryShort: title match
sourcePrimary: https://example.test/other
recordStatus: draft
visibility: public
---

---
id: candidate-2
title: New Title
aliases: [Alias Target]
summaryShort: alias match
sourcePrimary: https://example.test/other2
recordStatus: draft
visibility: public
---

---
id: candidate-3
title: Source Primary Match
summaryShort: source match
sourcePrimary: https://example.test/shared-source
recordStatus: draft
visibility: public
---

---
id: candidate-4
title: URL Match
summaryShort: url match
sourcePrimary: https://example.test/other4
externalLinks:
  - targetType: reference
    url: https://example.test/shared-url
    visibility: public
recordStatus: draft
visibility: public
---
`;

    const response = await app.request("/import-jobs/preview", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ sourceType: "markdown", markdown })
    });
    const job = await response.json() as {
      candidates: Array<{ proposedWorkId: string | null; matches: Array<{ matchType: string }> }>;
    };

    expect(job.candidates.find((c) => c.proposedWorkId === "candidate-1")?.matches.some((m) => m.matchType === "title_exact")).toBe(true);
    expect(job.candidates.find((c) => c.proposedWorkId === "candidate-2")?.matches.some((m) => m.matchType === "alias_exact")).toBe(true);
    expect(job.candidates.find((c) => c.proposedWorkId === "candidate-3")?.matches.some((m) => m.matchType === "source_exact")).toBe(true);
    expect(job.candidates.find((c) => c.proposedWorkId === "candidate-4")?.matches.some((m) => m.matchType === "external_url_exact")).toBe(true);
  });

  it("marks forward relations in the same import job as informational", async () => {
    const { db, path, cleanup } = createTempDatabase();
    cleanups.push(cleanup);
    const app = createAdminApp(db, { databasePath: path });
    const token = await bootstrapOwnerToken(db);

    const response = await app.request("/import-jobs/preview", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        sourceType: "markdown",
        markdown: `---
id: relation-source
title: Relation Source
summaryShort: relation source
sourcePrimary: https://example.test/relation-source
recordStatus: draft
visibility: public
relations:
  - targetWorkId: relation-target
    relationType: sequel
---

---
id: relation-target
title: Relation Target
summaryShort: relation target
sourcePrimary: https://example.test/relation-target
recordStatus: draft
visibility: public
---
`
      })
    });
    const job = await response.json() as {
      candidates: Array<{ proposedWorkId: string | null; issues: Array<{ severity: string; issueType: string }> }>;
    };

    const source = job.candidates.find((c) => c.proposedWorkId === "relation-source");
    expect(source?.issues).toContainEqual(expect.objectContaining({
      severity: "info",
      issueType: "relation_target_in_job"
    }));
    expect(source?.issues).not.toContainEqual(expect.objectContaining({
      severity: "warning",
      issueType: "relation_target_missing"
    }));
  });

  it("rejects invalid candidate actions", async () => {
    const { db, path, cleanup } = createTempDatabase();
    cleanups.push(cleanup);
    const app = createAdminApp(db, { databasePath: path });
    const token = await bootstrapOwnerToken(db);

    const preview = await app.request("/import-jobs/preview", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        sourceType: "markdown",
        markdown: `---
id: invalid-action-work
title: Invalid Action Work
summaryShort: invalid action
sourcePrimary: https://example.test/invalid-action
recordStatus: draft
visibility: public
---
`
      })
    });
    const job = await preview.json() as { candidates: Array<{ id: string }> };

    const response = await app.request(`/import-candidates/${job.candidates[0].id}`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ action: "publish_now" })
    });

    expect(response.status).toBe(400);
  });

  it("keeps partially failed jobs editable for retry", async () => {
    const { db, path, cleanup } = createTempDatabase();
    cleanups.push(cleanup);
    const app = createAdminApp(db, { databasePath: path });
    const token = await bootstrapOwnerToken(db);

    const preview = await app.request("/import-jobs/preview", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        sourceType: "markdown",
        markdown: `---
id: partial-success
title: Partial Success
summaryShort: partial success
sourcePrimary: https://example.test/partial-success
recordStatus: draft
visibility: public
---

---
id: partial-failure
title: Partial Failure
summaryShort: partial failure
sourcePrimary: https://example.test/partial-failure
recordStatus: draft
visibility: public
---
`
      })
    });
    const job = await preview.json() as { id: string; candidates: Array<{ id: string; proposedWorkId: string | null }> };
    const failing = job.candidates.find((c) => c.proposedWorkId === "partial-failure")!;

    await app.request(`/import-candidates/${failing.id}`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ action: "merge", targetWorkId: "missing-target" })
    });

    const execute = await app.request(`/import-jobs/${job.id}/execute`, {
      method: "POST",
      headers: jsonHeaders(token)
    });
    const executed = await execute.json() as {
      status: string;
      summary: { failedCount?: number };
      candidates: Array<{ proposedWorkId: string | null; status: string }>;
    };

    expect(execute.status).toBe(200);
    expect(executed.status).toBe("failed");
    expect(executed.summary.failedCount).toBe(1);
    expect(executed.candidates.find((c) => c.proposedWorkId === "partial-success")?.status).toBe("imported");
    expect(executed.candidates.find((c) => c.proposedWorkId === "partial-failure")?.status).toBe("failed");
  });

  it("imports nested metadata for created works", async () => {
    const { db, path, cleanup } = createTempDatabase();
    cleanups.push(cleanup);
    const app = createAdminApp(db, { databasePath: path });
    const token = await bootstrapOwnerToken(db);

    createWork(db, {
      id: "nested-target",
      title: "Nested Target",
      aliases: [],
      tags: [],
      summaryShort: "target",
      sourcePrimary: "https://example.test/nested-target",
      recordStatus: "draft",
      visibility: "public"
    });
    db.prepare("INSERT INTO taxonomies (id, code, name, created_at, updated_at) VALUES ('tax-nested', 'nested', 'Nested', datetime('now'), datetime('now'))").run();
    db.prepare("INSERT INTO taxonomy_terms (id, taxonomy_id, label, slug, created_at, updated_at) VALUES ('term-nested', 'tax-nested', 'Nested Term', 'nested-term', datetime('now'), datetime('now'))").run();

    const preview = await app.request("/import-jobs/preview", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        sourceType: "markdown",
        markdown: `---
id: nested-work
title: Nested Work
summaryShort: nested
sourcePrimary: https://example.test/nested-work
recordStatus: draft
visibility: public
releases:
  - releaseId: nested-release
    releaseTitle: Nested Release
    releaseStatus: draft
    accessEntries:
      - accessId: nested-access
        accessType: streaming
        url: https://example.test/watch
        visibility: public
externalLinks:
  - targetType: reference
    title: Ref
    url: https://example.test/ref
    visibility: public
sources:
  - sourceType: archive
    url: https://example.test/source
    title: Source
    visibility: public
taxonomyTerms:
  - termId: term-nested
    relationType: theme
    confidence: imported
    note: nested taxonomy
contributors:
  - name: Nested Person
    role: director
    creditName: N. Person
    visibility: public
covers:
  - id: nested-cover
    url: https://example.test/cover.jpg
    source: imported
    isPrimary: true
    visibility: public
relations:
  - targetWorkId: nested-target
    relationType: remake
    direction: directed
    visibility: public
---
`
      })
    });
    const job = await preview.json() as { id: string };

    const execute = await app.request(`/import-jobs/${job.id}/execute`, {
      method: "POST",
      headers: jsonHeaders(token)
    });

    expect(execute.status).toBe(200);
    expect(db.prepare("SELECT release_id FROM releases WHERE release_id = 'nested-release'").get()).toBeTruthy();
    expect(db.prepare("SELECT access_id FROM access_entries WHERE access_id = 'nested-access'").get()).toBeTruthy();
    expect(db.prepare("SELECT id FROM external_links WHERE work_id = 'nested-work' AND url = 'https://example.test/ref'").get()).toBeTruthy();
    expect(db.prepare("SELECT id FROM sources WHERE work_id = 'nested-work' AND url = 'https://example.test/source'").get()).toBeTruthy();
    expect(db.prepare("SELECT id FROM work_taxonomy_terms WHERE work_id = 'nested-work' AND term_id = 'term-nested'").get()).toBeTruthy();
    expect(db.prepare("SELECT id FROM contributors WHERE work_id = 'nested-work' AND name = 'Nested Person'").get()).toBeTruthy();
    expect(db.prepare("SELECT id FROM covers WHERE id = 'nested-cover' AND work_id = 'nested-work'").get()).toBeTruthy();
    expect(db.prepare("SELECT id FROM work_relations WHERE source_work_id = 'nested-work' AND target_work_id = 'nested-target'").get()).toBeTruthy();
  });
});
