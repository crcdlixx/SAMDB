import { Hono } from "hono";
import { canRole, isRole, type Role } from "@samdb/shared";
import type { SamDb } from "../db";
import { getActor, getRole, requireAuth, requirePermission } from "../middleware/auth";
import { createAccessEntry, deleteAccessEntry, getAccessEntryById, listAccessEntriesForRelease, updateAccessEntry } from "../services/accessEntries";
import { createAuditLog, listAuditLogs } from "../services/auditLogs";
import { createContributor, deleteContributor, getContributorById, listContributorsForWork, updateContributor } from "../services/contributors";
import { createCover, deleteCover, getCoverById, listCoversForWork, updateCover } from "../services/covers";
import { createExternalLink, deleteExternalLink, getExternalLinkById, listExternalLinksForWork, updateExternalLink } from "../services/externalLinks";
import { exportWorksToMarkdown, importWorkFromMarkdown } from "../services/importExport";
import {
  buildFieldComparison,
  createPreviewJob,
  executeImportJob,
  getImportJob,
  listImportJobs,
  updateImportCandidate,
  type CandidateAction
} from "../services/importGovernance";
import { getDefaultDatabasePath, listBackupSnapshots } from "../services/backup";
import { createWorkRelation, deleteWorkRelation, getWorkRelationById, listRelationQualityIssues, listRelationsForWork, updateWorkRelation } from "../services/relations";
import { createRelease, deleteRelease, getReleaseById, listReleasesForWork, updateRelease } from "../services/releases";
import { createSource, deleteSource, getSourceById, listSourcesForWork, updateSource } from "../services/sources";
import { createTaxonomy, createTerm, listTaxonomies, listTermsByTaxonomyCode } from "../services/taxonomies";
import { attachTermToWork, detachTermFromWork, listTermsForWork } from "../services/workTaxonomyTerms";
import { isReviewOnlyWorkPatch } from "../services/permissions";
import { createUser, getUserByUsername, listUsers, updateUserByUsername } from "../services/users";
import type { PublicUser } from "../services/users";
import { createWork, deleteWork, getWorkById, listWorks, updateWork } from "../services/works";

type AdminEnv = { Variables: { user: PublicUser } };

type AdminAppOptions = {
  databasePath?: string;
};

export function createAdminApp(db: SamDb, options: AdminAppOptions = {}): Hono<AdminEnv> {
  const databasePath = options.databasePath ?? getDefaultDatabasePath();
  const app = new Hono<AdminEnv>();

  app.use("*", requireAuth(db));
  app.use("*", async (c, next) => {
    const method = c.req.method.toUpperCase();
    const path = c.req.path;
    const role = getRole(c);

    if (method === "GET") {
      if (path.endsWith("/audit-logs") && !canRole(role, "read_audit")) {
        return c.json({ error: "Forbidden" }, 403);
      }
      return next();
    }

    if (method === "POST" && path.endsWith("/users")) {
      if (!canRole(role, "manage_users")) return c.json({ error: "Forbidden" }, 403);
      return next();
    }

    if (method === "POST" && (path.endsWith("/export") || path.endsWith("/import"))) {
      if (!canRole(role, "import_export")) return c.json({ error: "Forbidden" }, 403);
      return next();
    }

    if (method === "POST" && path.endsWith("/import-jobs/preview")) {
      if (!canRole(role, "import_export")) return c.json({ error: "Forbidden" }, 403);
      return next();
    }

    if (method === "POST" && /\/import-jobs\/[^/]+\/execute$/.test(path)) {
      if (!canRole(role, "import_export")) return c.json({ error: "Forbidden" }, 403);
      return next();
    }

    if (method === "PATCH" && /\/import-candidates\/[^/]+$/.test(path)) {
      if (!canRole(role, "import_export")) return c.json({ error: "Forbidden" }, 403);
      return next();
    }

    if (method === "GET" && (path.endsWith("/import-jobs") || /\/import-jobs\/[^/]+$/.test(path))) {
      return next();
    }

    if (method === "GET" && path.endsWith("/backups")) {
      return next();
    }

    if (method === "PATCH" && /\/works\/[^/]+$/.test(path) && role === "reviewer") {
      return next();
    }

    if (!canRole(role, "write_work")) return c.json({ error: "Forbidden" }, 403);
    return next();
  });

  app.get("/works", (c) => c.json(listWorks(db, { q: c.req.query("q") })));

  app.post("/works", requirePermission("write_work"), async (c) => {
    const body = await c.req.json();
    const work = createWork(db, body);
    createAuditLog(db, {
      entityType: "work",
      entityId: work.id,
      action: "create",
      actor: getActor(c),
      after: work
    });
    return c.json(work, 201);
  });

  app.get("/works/:id", (c) => {
    const work = getWorkById(db, c.req.param("id"));
    if (!work) return c.json({ error: "Not found" }, 404);
    return c.json(work);
  });

  app.patch("/works/:id", async (c) => {
    const body = await c.req.json();
    const role = getRole(c);
    if (role === "reviewer") {
      if (!isReviewOnlyWorkPatch(body)) return c.json({ error: "Forbidden" }, 403);
    } else if (!roleCanWriteWork(role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const id = c.req.param("id");
    const before = getWorkById(db, id);
    const work = updateWork(db, id, body);
    createAuditLog(db, {
      entityType: "work",
      entityId: work.id,
      action: "update",
      actor: getActor(c),
      before,
      after: work
    });
    return c.json(work);
  });

  app.delete("/works/:id", requirePermission("write_work"), (c) => {
    const id = c.req.param("id");
    const before = getWorkById(db, id);
    deleteWork(db, id);
    createAuditLog(db, {
      entityType: "work",
      entityId: id,
      action: "delete",
      actor: getActor(c),
      before
    });
    return c.body(null, 204);
  });

  app.get("/works/:id/releases", (c) => c.json({ items: listReleasesForWork(db, c.req.param("id")) }));

  app.post("/works/:id/releases", requirePermission("write_work"), async (c) => {
    const release = createRelease(db, { ...(await c.req.json()), parentWorkId: c.req.param("id") });
    createAuditLog(db, {
      entityType: "release",
      entityId: release.releaseId,
      action: "create",
      actor: getActor(c),
      after: release
    });
    return c.json(release, 201);
  });

  app.patch("/releases/:releaseId", async (c) => {
    const releaseId = c.req.param("releaseId");
    const before = getReleaseById(db, releaseId);
    const release = updateRelease(db, releaseId, await c.req.json());
    createAuditLog(db, {
      entityType: "release",
      entityId: release.releaseId,
      action: "update",
      actor: getActor(c),
      before,
      after: release
    });
    return c.json(release);
  });

  app.delete("/releases/:releaseId", (c) => {
    const release = deleteRelease(db, c.req.param("releaseId"));
    createAuditLog(db, {
      entityType: "release",
      entityId: release.releaseId,
      action: "delete",
      actor: getActor(c),
      before: release
    });
    return c.body(null, 204);
  });

  app.get("/releases/:releaseId/access", (c) => c.json({ items: listAccessEntriesForRelease(db, c.req.param("releaseId")) }));

  app.post("/releases/:releaseId/access", async (c) => {
    const accessEntry = createAccessEntry(db, { ...(await c.req.json()), parentReleaseId: c.req.param("releaseId") });
    createAuditLog(db, {
      entityType: "access_entry",
      entityId: accessEntry.accessId,
      action: "create",
      actor: getActor(c),
      after: accessEntry
    });
    return c.json(accessEntry, 201);
  });

  app.patch("/access/:accessId", async (c) => {
    const accessId = c.req.param("accessId");
    const before = getAccessEntryById(db, accessId);
    const accessEntry = updateAccessEntry(db, accessId, await c.req.json());
    createAuditLog(db, {
      entityType: "access_entry",
      entityId: accessEntry.accessId,
      action: "update",
      actor: getActor(c),
      before,
      after: accessEntry
    });
    return c.json(accessEntry);
  });

  app.delete("/access/:accessId", (c) => {
    const accessEntry = deleteAccessEntry(db, c.req.param("accessId"));
    createAuditLog(db, {
      entityType: "access_entry",
      entityId: accessEntry.accessId,
      action: "delete",
      actor: getActor(c),
      before: accessEntry
    });
    return c.body(null, 204);
  });

  app.get("/taxonomies", (c) => c.json({ items: listTaxonomies(db) }));

  app.post("/taxonomies", async (c) => {
    const body = await c.req.json();
    createTaxonomy(db, body);
    createAuditLog(db, {
      entityType: "taxonomy",
      entityId: body.id,
      action: "create",
      actor: getActor(c),
      after: body
    });
    return c.json({ ok: true }, 201);
  });

  app.get("/taxonomies/:code/terms", (c) => c.json({ items: listTermsByTaxonomyCode(db, c.req.param("code")) }));

  app.post("/taxonomies/:code/terms", async (c) => {
    const body = await c.req.json();
    createTerm(db, body);
    createAuditLog(db, {
      entityType: "taxonomy_term",
      entityId: body.id,
      action: "create",
      actor: getActor(c),
      after: body
    });
    return c.json({ ok: true }, 201);
  });

  app.get("/works/:id/taxonomy-terms", (c) => c.json({ items: listTermsForWork(db, c.req.param("id")) }));

  app.post("/works/:id/taxonomy-terms", async (c) => {
    const attached = attachTermToWork(db, { ...(await c.req.json()), workId: c.req.param("id") });
    createAuditLog(db, {
      entityType: "work_taxonomy_term",
      entityId: String(attached.id),
      action: "create",
      actor: getActor(c),
      after: attached
    });
    return c.json({ ok: true, attached }, 201);
  });

  app.delete("/work-taxonomy-terms/:attachmentId", (c) => {
    const detached = detachTermFromWork(db, Number(c.req.param("attachmentId")));
    createAuditLog(db, {
      entityType: "work_taxonomy_term",
      entityId: String(detached.id),
      action: "delete",
      actor: getActor(c),
      before: detached
    });
    return c.body(null, 204);
  });

  app.get("/works/:id/relations", (c) => c.json({ items: listRelationsForWork(db, c.req.param("id")) }));
  app.get("/relation-quality", (c) => c.json(listRelationQualityIssues(db)));

  app.post("/works/:id/relations", async (c) => {
    const relation = createWorkRelation(db, { ...(await c.req.json()), sourceWorkId: c.req.param("id") });
    createAuditLog(db, {
      entityType: "work_relation",
      entityId: String(relation.id),
      action: "create",
      actor: getActor(c),
      after: relation
    });
    return c.json({ ok: true, relation }, 201);
  });

  app.patch("/relations/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const before = getWorkRelationById(db, id);
    const relation = updateWorkRelation(db, id, await c.req.json());
    createAuditLog(db, {
      entityType: "work_relation",
      entityId: String(relation.id),
      action: "update",
      actor: getActor(c),
      before,
      after: relation
    });
    return c.json(relation);
  });

  app.delete("/relations/:id", (c) => {
    const relation = deleteWorkRelation(db, Number(c.req.param("id")));
    createAuditLog(db, {
      entityType: "work_relation",
      entityId: String(relation.id),
      action: "delete",
      actor: getActor(c),
      before: relation
    });
    return c.body(null, 204);
  });

  app.get("/works/:id/contributors", (c) => c.json({ items: listContributorsForWork(db, c.req.param("id")) }));

  app.post("/works/:id/contributors", async (c) => {
    const contributor = createContributor(db, { ...(await c.req.json()), workId: c.req.param("id") });
    createAuditLog(db, {
      entityType: "contributor",
      entityId: String(contributor.id),
      action: "create",
      actor: getActor(c),
      after: contributor
    });
    return c.json(contributor, 201);
  });

  app.patch("/contributors/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const before = getContributorById(db, id);
    const contributor = updateContributor(db, id, await c.req.json());
    createAuditLog(db, {
      entityType: "contributor",
      entityId: String(contributor.id),
      action: "update",
      actor: getActor(c),
      before,
      after: contributor
    });
    return c.json(contributor);
  });

  app.delete("/contributors/:id", (c) => {
    const contributor = deleteContributor(db, Number(c.req.param("id")));
    createAuditLog(db, {
      entityType: "contributor",
      entityId: String(contributor.id),
      action: "delete",
      actor: getActor(c),
      before: contributor
    });
    return c.body(null, 204);
  });

  app.get("/works/:id/covers", (c) => c.json({ items: listCoversForWork(db, c.req.param("id")) }));

  app.post("/works/:id/covers", async (c) => {
    const cover = createCover(db, { ...(await c.req.json()), workId: c.req.param("id") });
    createAuditLog(db, {
      entityType: "cover",
      entityId: cover.id,
      action: "create",
      actor: getActor(c),
      after: cover
    });
    return c.json(cover, 201);
  });

  app.patch("/covers/:id", async (c) => {
    const id = c.req.param("id");
    const before = getCoverById(db, id);
    const cover = updateCover(db, id, await c.req.json());
    createAuditLog(db, {
      entityType: "cover",
      entityId: cover.id,
      action: "update",
      actor: getActor(c),
      before,
      after: cover
    });
    return c.json(cover);
  });

  app.delete("/covers/:id", (c) => {
    const cover = deleteCover(db, c.req.param("id"));
    createAuditLog(db, {
      entityType: "cover",
      entityId: cover.id,
      action: "delete",
      actor: getActor(c),
      before: cover
    });
    return c.body(null, 204);
  });

  app.get("/works/:id/sources", (c) => c.json({ items: listSourcesForWork(db, c.req.param("id")) }));

  app.post("/works/:id/sources", async (c) => {
    const source = createSource(db, { ...(await c.req.json()), workId: c.req.param("id") });
    createAuditLog(db, {
      entityType: "source",
      entityId: String(source.id),
      action: "create",
      actor: getActor(c),
      after: source
    });
    return c.json(source, 201);
  });

  app.patch("/sources/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const before = getSourceById(db, id);
    const source = updateSource(db, id, await c.req.json());
    createAuditLog(db, {
      entityType: "source",
      entityId: String(source.id),
      action: "update",
      actor: getActor(c),
      before,
      after: source
    });
    return c.json(source);
  });

  app.delete("/sources/:id", (c) => {
    const source = deleteSource(db, Number(c.req.param("id")));
    createAuditLog(db, {
      entityType: "source",
      entityId: String(source.id),
      action: "delete",
      actor: getActor(c),
      before: source
    });
    return c.body(null, 204);
  });

  app.get("/works/:id/external-links", (c) => c.json({ items: listExternalLinksForWork(db, c.req.param("id")) }));

  app.post("/works/:id/external-links", async (c) => {
    const link = createExternalLink(db, { ...(await c.req.json()), workId: c.req.param("id") });
    createAuditLog(db, {
      entityType: "external_link",
      entityId: String(link.id),
      action: "create",
      actor: getActor(c),
      after: link
    });
    return c.json(link, 201);
  });

  app.patch("/external-links/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const before = getExternalLinkById(db, id);
    const link = updateExternalLink(db, id, await c.req.json());
    createAuditLog(db, {
      entityType: "external_link",
      entityId: String(link.id),
      action: "update",
      actor: getActor(c),
      before,
      after: link
    });
    return c.json(link);
  });

  app.delete("/external-links/:id", (c) => {
    const link = deleteExternalLink(db, Number(c.req.param("id")));
    createAuditLog(db, {
      entityType: "external_link",
      entityId: String(link.id),
      action: "delete",
      actor: getActor(c),
      before: link
    });
    return c.body(null, 204);
  });

  app.post("/export", (c) => {
    const files = exportWorksToMarkdown(db);
    createAuditLog(db, {
      entityType: "export",
      entityId: "works",
      action: "export",
      actor: getActor(c),
      after: { files }
    });
    return c.json({ files });
  });

  app.post("/import", async (c) => {
    const body = await c.req.json() as { markdown?: string };
    if (!body.markdown) return c.json({ error: "markdown is required" }, 400);
    const work = importWorkFromMarkdown(db, body.markdown);
    createAuditLog(db, {
      entityType: "work",
      entityId: work.id,
      action: "import",
      actor: getActor(c),
      after: work
    });
    return c.json(work, 201);
  });

  app.post("/import-jobs/preview", async (c) => {
    const body = await c.req.json() as {
      sourceType?: "markdown" | "json";
      markdown?: string;
      items?: Record<string, unknown>[];
    };
    if (!body.sourceType) return c.json({ error: "sourceType is required" }, 400);
    if (body.sourceType === "markdown" && !body.markdown?.trim()) {
      return c.json({ error: "markdown is required for markdown sourceType" }, 400);
    }
    if (body.sourceType === "json" && (!body.items || !Array.isArray(body.items))) {
      return c.json({ error: "items array is required for json sourceType" }, 400);
    }

    const job = createPreviewJob(db, {
      sourceType: body.sourceType,
      markdown: body.markdown,
      items: body.items,
      actor: getActor(c)
    });
    createAuditLog(db, {
      entityType: "import_job",
      entityId: job.id,
      action: "preview",
      actor: getActor(c),
      after: { summary: job.summary, candidateCount: job.candidates.length }
    });
    return c.json(job, 201);
  });

  app.get("/import-jobs", (c) => c.json(listImportJobs(db)));

  app.get("/import-jobs/:id", (c) => {
    const job = getImportJob(db, c.req.param("id"));
    if (!job) return c.json({ error: "Not found" }, 404);
    return c.json(job);
  });

  app.patch("/import-candidates/:id", async (c) => {
    const body = await c.req.json() as { action?: CandidateAction; targetWorkId?: string | null };
    const candidateId = c.req.param("id");
    try {
      const candidate = updateImportCandidate(db, candidateId, body);
      createAuditLog(db, {
        entityType: "import_candidate",
        entityId: candidateId,
        action: "update_candidate",
        actor: getActor(c),
        after: { action: candidate.action, targetWorkId: candidate.targetWorkId }
      });
      return c.json(candidate);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Update failed";
      if (message.includes("not found")) return c.json({ error: message }, 404);
      return c.json({ error: message }, 400);
    }
  });

  app.post("/import-jobs/:id/execute", async (c) => {
    const jobId = c.req.param("id");
    const job = getImportJob(db, jobId);
    if (!job) return c.json({ error: "Not found" }, 404);

    try {
      const executed = executeImportJob(db, jobId, {
        actor: getActor(c),
        databasePath
      });

      if (executed.summary?.backupFile) {
        createAuditLog(db, {
          entityType: "backup",
          entityId: jobId,
          action: "create",
          actor: getActor(c),
          after: { filePath: executed.summary.backupFile, relatedJobId: jobId }
        });
      }

      for (const candidate of executed.candidates) {
        if (candidate.status === "skipped") {
          createAuditLog(db, {
            entityType: "work",
            entityId: candidate.proposedWorkId ?? candidate.id,
            action: "import_skip",
            actor: getActor(c),
            after: { candidateId: candidate.id }
          });
          continue;
        }
        if (candidate.status !== "imported") continue;
        const auditAction = candidate.action === "create"
          ? "import_create"
          : candidate.action === "overwrite"
            ? "import_overwrite"
            : candidate.action === "merge"
              ? "import_merge"
              : null;
        if (!auditAction || !candidate.resultWorkId) continue;
        createAuditLog(db, {
          entityType: "work",
          entityId: candidate.resultWorkId,
          action: auditAction,
          actor: getActor(c),
          after: { candidateId: candidate.id, action: candidate.action }
        });
      }

      createAuditLog(db, {
        entityType: "import_job",
        entityId: jobId,
        action: "execute",
        actor: getActor(c),
        after: executed.summary
      });

      return c.json(executed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed";
      if (message.includes("requires review") || message.includes("blocking errors") || message.includes("does not allow") || message.includes("No executable")) {
        return c.json({ error: message }, 409);
      }
      return c.json({ error: message }, 500);
    }
  });

  app.get("/backups", (c) => {
    const role = getRole(c);
    const result = listBackupSnapshots(db);
    if (role !== "owner") {
      return c.json({
        items: result.items.map((item) => ({
          ...item,
          filePath: item.filePath.replace(/[^/\\]+$/, "[hidden]")
        }))
      });
    }
    return c.json(result);
  });

  app.get("/import-candidates/:id/comparison", (c) => {
    const comparison = buildFieldComparison(db, c.req.param("id"));
    if (!comparison) return c.json({ error: "No comparison available" }, 404);
    return c.json({ items: comparison });
  });

  app.get("/audit-logs", requirePermission("read_audit"), (c) => {
    const limit = Number(c.req.query("limit") ?? 50);
    return c.json(listAuditLogs(db, { limit }));
  });

  app.post("/users", requirePermission("manage_users"), async (c) => {
    const body = await c.req.json() as {
      username?: string;
      password?: string;
      displayName?: string | null;
      role?: string;
    };
    if (!body.username || !body.password || !body.role || !isRole(body.role)) {
      return c.json({ error: "username, password, and valid role are required" }, 400);
    }
    const user = createUser(db, {
      username: body.username,
      password: body.password,
      displayName: body.displayName ?? null,
      role: body.role
    });
    createAuditLog(db, {
      entityType: "user",
      entityId: user.id,
      action: "create",
      actor: getActor(c),
      after: user
    });
    return c.json(user, 201);
  });

  app.get("/users", requirePermission("manage_users"), (c) => c.json(listUsers(db)));

  app.patch("/users/:username", requirePermission("manage_users"), async (c) => {
    const username = c.req.param("username");
    const before = getUserByUsername(db, username);
    if (!before) return c.json({ error: "Not found" }, 404);
    const body = await c.req.json() as {
      role?: string;
      displayName?: string | null;
      isActive?: boolean;
    };
    if (body.role && !isRole(body.role)) return c.json({ error: "Invalid role" }, 400);
    const role = body.role && isRole(body.role) ? body.role : undefined;
    const user = updateUserByUsername(db, username, {
      role,
      displayName: body.displayName,
      isActive: body.isActive
    });
    createAuditLog(db, {
      entityType: "user",
      entityId: user.id,
      action: "update",
      actor: getActor(c),
      before,
      after: user
    });
    return c.json(user);
  });

  return app;
}

function roleCanWriteWork(role: Role): boolean {
  return role === "owner" || role === "editor";
}
