import { randomUUID } from "node:crypto";
import type { WorkInput } from "@samdb/shared";
import type { SamDb } from "../db";
import { nowIso } from "../db";
import { createAccessEntry } from "./accessEntries";
import { createDatabaseBackup } from "./backup";
import { createContributor } from "./contributors";
import { createCover } from "./covers";
import { createExternalLink } from "./externalLinks";
import {
  asStringArray,
  extractAccessEntries,
  extractExternalUrls,
  extractRelations,
  isValidRecordStatus,
  isValidRelationType,
  isValidReleaseStatus,
  isValidVisibility,
  normalizeTitle,
  parseJsonCandidate,
  parseMarkdownBlock,
  splitMarkdownDocuments,
  type ParsedCandidate
} from "./importParser";
import { createRelease } from "./releases";
import { createWorkRelation } from "./relations";
import { createSource } from "./sources";
import { attachTermToWork } from "./workTaxonomyTerms";
import { createWork, getWorkById, updateWork, type WorkView } from "./works";

export type ImportJobStatus =
  | "previewing"
  | "ready"
  | "needs_review"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export type CandidateStatus = "valid" | "warning" | "invalid" | "ready" | "imported" | "skipped" | "failed";
export type CandidateAction = "create" | "skip" | "overwrite" | "merge" | "needs_review";

export type ImportJobSummary = {
  totalCandidates: number;
  validCount: number;
  warningCount: number;
  invalidCount: number;
  errorCount: number;
  matchCount: number;
  createCount: number;
  skipCount: number;
  overwriteCount: number;
  mergeCount: number;
  needsReviewCount: number;
  backupFile?: string;
  successCount?: number;
  failedCount?: number;
};

export type CandidateIssueView = {
  id: number;
  severity: "error" | "warning" | "info";
  issueType: string;
  fieldPath: string | null;
  message: string;
  createdAt: string;
};

export type CandidateMatchView = {
  id: number;
  existingWorkId: string;
  existingTitle: string | null;
  matchType: string;
  score: number;
  evidence: Record<string, unknown>;
  createdAt: string;
};

export type ImportCandidateView = {
  id: string;
  jobId: string;
  sourceIndex: number;
  proposedWorkId: string | null;
  proposedTitle: string | null;
  parsed: Record<string, unknown>;
  status: CandidateStatus;
  action: CandidateAction;
  targetWorkId: string | null;
  resultWorkId: string | null;
  errorMessage: string | null;
  issues: CandidateIssueView[];
  matches: CandidateMatchView[];
  createdAt: string;
  updatedAt: string;
};

export type ImportJobView = {
  id: string;
  sourceType: string;
  status: ImportJobStatus;
  actor: string | null;
  summary: ImportJobSummary | null;
  createdAt: string;
  updatedAt: string;
  executedAt: string | null;
  candidates: ImportCandidateView[];
};

type JobRow = {
  id: string;
  source_type: string;
  status: string;
  actor: string | null;
  raw_input_path: string | null;
  summary_json: string | null;
  created_at: string;
  updated_at: string;
  executed_at: string | null;
};

type CandidateRow = {
  id: string;
  job_id: string;
  source_index: number;
  proposed_work_id: string | null;
  proposed_title: string | null;
  parsed_json: string;
  status: string;
  action: string;
  target_work_id: string | null;
  result_work_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

const STRONG_MATCH_TYPES = new Set(["id_exact", "source_exact", "external_url_exact"]);
const CANDIDATE_ACTIONS = new Set<CandidateAction>(["create", "skip", "overwrite", "merge", "needs_review"]);

function isCandidateAction(value: unknown): value is CandidateAction {
  return typeof value === "string" && CANDIDATE_ACTIONS.has(value as CandidateAction);
}

export function createPreviewJob(
  db: SamDb,
  input: {
    sourceType: "markdown" | "json";
    markdown?: string;
    items?: Record<string, unknown>[];
    actor?: string | null;
  }
): ImportJobView {
  const jobId = randomUUID();
  const now = nowIso();
  const rawItems = input.sourceType === "markdown"
    ? splitMarkdownDocuments(input.markdown ?? "").map((block) => ({ type: "markdown" as const, block }))
    : (input.items ?? []).map((item) => ({ type: "json" as const, item }));

  db.prepare(`
    INSERT INTO import_jobs (id, source_type, status, actor, summary_json, created_at, updated_at)
    VALUES (?, ?, 'previewing', ?, NULL, ?, ?)
  `).run(jobId, input.sourceType, input.actor ?? null, now, now);

  const parsedItems = rawItems.map((raw, index) => {
    const candidateId = randomUUID();
    const parsed = raw.type === "markdown"
      ? parseMarkdownBlock(raw.block)
      : parseJsonCandidate(raw.item);
    return { candidateId, index, parsed };
  });

  const proposedIdsInJob = new Map<string, number>();
  for (const item of parsedItems) {
    if (item.parsed.ok && item.parsed.workInput.id) {
      proposedIdsInJob.set(item.parsed.workInput.id, item.index);
    }
  }

  for (const item of parsedItems) {
    const { candidateId, index, parsed } = item;

    if (!parsed.ok) {
      insertCandidate(db, {
        id: candidateId,
        jobId,
        sourceIndex: index,
        parsed: { error: parsed.error, raw: parsed.raw },
        status: "invalid",
        action: "needs_review",
        errorMessage: parsed.error,
        now
      });
      insertIssue(db, candidateId, "error", "parse_error", null, parsed.error, now);
      continue;
    }

    const fields = parsed.fields;
    const workInput = parsed.workInput;
    const proposedId = workInput.id ?? null;
    const proposedTitle = workInput.title ?? null;

    const { issues, hasError, hasWarning } = validateCandidate(db, fields, workInput, jobId, proposedIdsInJob, index);
    const matches = detectDuplicates(db, fields, workInput);
    const hasStrongMatch = matches.some((m) => STRONG_MATCH_TYPES.has(m.matchType));

    let action: CandidateAction = "create";
    if (hasError || !parsed.ok) {
      action = "needs_review";
    } else if (hasStrongMatch) {
      action = "needs_review";
    } else if (hasWarning) {
      action = "needs_review";
    }

    let status: CandidateStatus = "valid";
    if (hasError) status = "invalid";
    else if (hasWarning) status = "warning";

    const targetWorkId = matches.find((m) => STRONG_MATCH_TYPES.has(m.matchType))?.existingWorkId
      ?? matches[0]?.existingWorkId
      ?? null;

    insertCandidate(db, {
      id: candidateId,
      jobId,
      sourceIndex: index,
      proposedWorkId: proposedId,
      proposedTitle,
      parsed: fields,
      status,
      action,
      targetWorkId,
      now
    });

    for (const issue of issues) {
      insertIssue(db, candidateId, issue.severity, issue.issueType, issue.fieldPath, issue.message, now);
    }
    for (const match of matches) {
      insertMatch(db, candidateId, match, now);
    }
  }

  const summary = computeJobSummary(db, jobId);
  const jobStatus = deriveJobStatus(summary);
  db.prepare(`
    UPDATE import_jobs SET status = ?, summary_json = ?, updated_at = ? WHERE id = ?
  `).run(jobStatus, JSON.stringify(summary), nowIso(), jobId);

  return getImportJob(db, jobId)!;
}

function insertCandidate(
  db: SamDb,
  input: {
    id: string;
    jobId: string;
    sourceIndex: number;
    proposedWorkId?: string | null;
    proposedTitle?: string | null;
    parsed: Record<string, unknown>;
    status: CandidateStatus;
    action: CandidateAction;
    targetWorkId?: string | null;
    errorMessage?: string | null;
    now: string;
  }
): void {
  db.prepare(`
    INSERT INTO import_candidates (
      id, job_id, source_index, proposed_work_id, proposed_title, parsed_json,
      status, action, target_work_id, result_work_id, error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
  `).run(
    input.id,
    input.jobId,
    input.sourceIndex,
    input.proposedWorkId ?? null,
    input.proposedTitle ?? null,
    JSON.stringify(input.parsed),
    input.status,
    input.action,
    input.targetWorkId ?? null,
    input.errorMessage ?? null,
    input.now,
    input.now
  );
}

function insertIssue(
  db: SamDb,
  candidateId: string,
  severity: "error" | "warning" | "info",
  issueType: string,
  fieldPath: string | null,
  message: string,
  now: string
): void {
  db.prepare(`
    INSERT INTO import_candidate_issues (candidate_id, severity, issue_type, field_path, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(candidateId, severity, issueType, fieldPath, message, now);
}

function insertMatch(
  db: SamDb,
  candidateId: string,
  match: { existingWorkId: string; matchType: string; score: number; evidence: Record<string, unknown> },
  now: string
): void {
  db.prepare(`
    INSERT INTO import_candidate_matches (candidate_id, existing_work_id, match_type, score, evidence_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(candidateId, match.existingWorkId, match.matchType, match.score, JSON.stringify(match.evidence), now);
}

type ValidationIssue = {
  severity: "error" | "warning" | "info";
  issueType: string;
  fieldPath: string | null;
  message: string;
};

function validateCandidate(
  db: SamDb,
  fields: Record<string, unknown>,
  workInput: Partial<WorkInput>,
  jobId: string,
  proposedIdsInJob: Map<string, number>,
  sourceIndex: number
): { issues: ValidationIssue[]; hasError: boolean; hasWarning: boolean } {
  const issues: ValidationIssue[] = [];

  if (!workInput.title) {
    issues.push({ severity: "error", issueType: "missing_field", fieldPath: "title", message: "缺少必填字段 title" });
  }
  if (!workInput.summaryShort) {
    issues.push({ severity: "warning", issueType: "missing_field", fieldPath: "summaryShort", message: "缺少 summaryShort" });
  }
  if (!workInput.sourcePrimary) {
    issues.push({ severity: "warning", issueType: "missing_field", fieldPath: "sourcePrimary", message: "缺少 sourcePrimary" });
  }
  if (!workInput.recordStatus) {
    issues.push({ severity: "warning", issueType: "missing_field", fieldPath: "recordStatus", message: "缺少 recordStatus，将使用默认值" });
  }
  if (!workInput.visibility) {
    issues.push({ severity: "warning", issueType: "missing_field", fieldPath: "visibility", message: "缺少 visibility，将使用默认值" });
  }

  if (workInput.recordStatus && !isValidRecordStatus(workInput.recordStatus)) {
    issues.push({ severity: "error", issueType: "invalid_enum", fieldPath: "recordStatus", message: `非法 recordStatus: ${workInput.recordStatus}` });
  }
  if (workInput.visibility && !isValidVisibility(workInput.visibility)) {
    issues.push({ severity: "error", issueType: "invalid_enum", fieldPath: "visibility", message: `非法 visibility: ${workInput.visibility}` });
  }

  const releases = fields.releases;
  if (Array.isArray(releases)) {
    releases.forEach((release, i) => {
      if (release && typeof release === "object" && "releaseStatus" in release) {
        const status = String((release as Record<string, unknown>).releaseStatus);
        if (!isValidReleaseStatus(status)) {
          issues.push({ severity: "error", issueType: "invalid_enum", fieldPath: `releases[${i}].releaseStatus`, message: `非法 releaseStatus: ${status}` });
        }
      }
    });
  }

  const relations = extractRelations(fields);
  for (const relation of relations) {
    if (relation.relationType && !isValidRelationType(relation.relationType)) {
      issues.push({ severity: "error", issueType: "invalid_enum", fieldPath: "relations.relationType", message: `非法 relationType: ${relation.relationType}` });
    }
    const existsInDb = getWorkById(db, relation.targetWorkId);
    const inSameJob = proposedIdsInJob.has(relation.targetWorkId) && proposedIdsInJob.get(relation.targetWorkId) !== sourceIndex;
    if (existsInDb) continue;
    if (inSameJob) {
      issues.push({ severity: "info", issueType: "relation_target_in_job", fieldPath: "relations", message: `关系目标 ${relation.targetWorkId} 在同一导入任务中` });
    } else {
      issues.push({ severity: "warning", issueType: "relation_target_missing", fieldPath: "relations", message: `关系目标 ${relation.targetWorkId} 不存在，关系不会自动写入` });
    }
  }

  if (workInput.visibility === "public") {
    const accessEntries = extractAccessEntries(fields);
    for (const entry of accessEntries) {
      if (entry.visibility === "internal" || entry.visibility === "restricted") {
        issues.push({ severity: "warning", issueType: "visibility_risk", fieldPath: "releases.accessEntries", message: "公开作品包含 restricted/internal 获取方式" });
        break;
      }
    }
  }

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  return { issues, hasError, hasWarning };
}

type DuplicateMatch = {
  existingWorkId: string;
  matchType: string;
  score: number;
  evidence: Record<string, unknown>;
};

function detectDuplicates(db: SamDb, fields: Record<string, unknown>, workInput: Partial<WorkInput>): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const seen = new Set<string>();

  function addMatch(existingWorkId: string, matchType: string, score: number, evidence: Record<string, unknown>): void {
    const key = `${existingWorkId}:${matchType}`;
    if (seen.has(key)) return;
    seen.add(key);
    matches.push({ existingWorkId, matchType, score, evidence });
  }

  if (workInput.id) {
    const existing = getWorkById(db, workInput.id);
    if (existing) {
      addMatch(existing.id, "id_exact", 1.0, { id: workInput.id });
    }
  }

  if (workInput.sourcePrimary) {
    const row = db.prepare("SELECT id FROM works WHERE source_primary = ?").get(workInput.sourcePrimary) as { id: string } | undefined;
    if (row) {
      addMatch(row.id, "source_exact", 1.0, { sourcePrimary: workInput.sourcePrimary });
    }
  }

  for (const url of extractExternalUrls(fields)) {
    const row = db.prepare("SELECT work_id FROM external_links WHERE url = ?").get(url) as { work_id: string } | undefined;
    if (row) {
      addMatch(row.work_id, "external_url_exact", 1.0, { url });
    }
  }

  if (workInput.title) {
    const row = db.prepare("SELECT id FROM works WHERE title = ?").get(workInput.title) as { id: string } | undefined;
    if (row) {
      addMatch(row.id, "title_exact", 0.9, { title: workInput.title });
    }
  }

  const aliases = asStringArray(workInput.aliases);
  for (const alias of aliases) {
    const rows = db.prepare(`
      SELECT id, title, aliases_json FROM works
      WHERE title = ? OR aliases_json LIKE ?
    `).all(alias, `%"${alias}"%`) as Array<{ id: string; title: string; aliases_json: string | null }>;
    for (const row of rows) {
      addMatch(row.id, "alias_exact", 0.85, { alias, matchedWork: row.title });
    }
  }

  if (workInput.title) {
    const rows = db.prepare("SELECT id, title, aliases_json FROM works").all() as Array<{ id: string; title: string; aliases_json: string | null }>;
    for (const row of rows) {
      const workAliases = row.aliases_json ? JSON.parse(row.aliases_json) as string[] : [];
      if (workAliases.includes(workInput.title!)) {
        addMatch(row.id, "alias_exact", 0.85, { candidateTitle: workInput.title, matchedAlias: workInput.title });
      }
    }
  }

  if (workInput.series && workInput.year) {
    const year = parseInt(workInput.year, 10);
    if (!Number.isNaN(year)) {
      const rows = db.prepare(`
        SELECT id, year FROM works WHERE series = ?
      `).all(workInput.series) as Array<{ id: string; year: string | null }>;
      for (const row of rows) {
        const existingYear = row.year ? parseInt(row.year, 10) : NaN;
        if (!Number.isNaN(existingYear) && Math.abs(existingYear - year) <= 1) {
          addMatch(row.id, "series_year_near", 0.7, { series: workInput.series, year: workInput.year, existingYear: row.year });
        }
      }
    }
  }

  if (workInput.title) {
    const normalized = normalizeTitle(workInput.title);
    const rows = db.prepare("SELECT id, title FROM works").all() as Array<{ id: string; title: string }>;
    for (const row of rows) {
      if (normalizeTitle(row.title) === normalized && row.title !== workInput.title) {
        addMatch(row.id, "title_fuzzy", 0.6, { candidateTitle: workInput.title, existingTitle: row.title });
      }
    }
  }

  return matches;
}

function computeJobSummary(db: SamDb, jobId: string): ImportJobSummary {
  const candidates = db.prepare(`
    SELECT status, action FROM import_candidates WHERE job_id = ?
  `).all(jobId) as Array<{ status: string; action: string }>;

  const errorCount = (db.prepare(`
    SELECT COUNT(*) as count FROM import_candidate_issues i
    JOIN import_candidates c ON c.id = i.candidate_id
    WHERE c.job_id = ? AND i.severity = 'error'
  `).get(jobId) as { count: number }).count;

  const matchCount = (db.prepare(`
    SELECT COUNT(*) as count FROM import_candidate_matches m
    JOIN import_candidates c ON c.id = m.candidate_id
    WHERE c.job_id = ?
  `).get(jobId) as { count: number }).count;

  return {
    totalCandidates: candidates.length,
    validCount: candidates.filter((c) => c.status === "valid").length,
    warningCount: candidates.filter((c) => c.status === "warning").length,
    invalidCount: candidates.filter((c) => c.status === "invalid").length,
    errorCount,
    matchCount,
    createCount: candidates.filter((c) => c.action === "create").length,
    skipCount: candidates.filter((c) => c.action === "skip").length,
    overwriteCount: candidates.filter((c) => c.action === "overwrite").length,
    mergeCount: candidates.filter((c) => c.action === "merge").length,
    needsReviewCount: candidates.filter((c) => c.action === "needs_review").length
  };
}

function deriveJobStatus(summary: ImportJobSummary): ImportJobStatus {
  if (summary.needsReviewCount > 0 || summary.invalidCount > 0) return "needs_review";
  return "ready";
}

export function listImportJobs(db: SamDb): { items: Omit<ImportJobView, "candidates">[] } {
  const rows = db.prepare(`
    SELECT * FROM import_jobs ORDER BY created_at DESC
  `).all() as JobRow[];

  return {
    items: rows.map((row) => ({
      id: row.id,
      sourceType: row.source_type,
      status: row.status as ImportJobStatus,
      actor: row.actor,
      summary: row.summary_json ? JSON.parse(row.summary_json) as ImportJobSummary : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      executedAt: row.executed_at
    }))
  };
}

export function getImportJob(db: SamDb, jobId: string): ImportJobView | null {
  const row = db.prepare("SELECT * FROM import_jobs WHERE id = ?").get(jobId) as JobRow | undefined;
  if (!row) return null;

  const candidates = listCandidatesForJob(db, jobId);
  return {
    id: row.id,
    sourceType: row.source_type,
    status: row.status as ImportJobStatus,
    actor: row.actor,
    summary: row.summary_json ? JSON.parse(row.summary_json) as ImportJobSummary : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    executedAt: row.executed_at,
    candidates
  };
}

function listCandidatesForJob(db: SamDb, jobId: string): ImportCandidateView[] {
  const rows = db.prepare(`
    SELECT * FROM import_candidates WHERE job_id = ? ORDER BY source_index ASC
  `).all(jobId) as CandidateRow[];

  return rows.map((row) => toCandidateView(db, row));
}

function toCandidateView(db: SamDb, row: CandidateRow): ImportCandidateView {
  const issues = db.prepare(`
    SELECT * FROM import_candidate_issues WHERE candidate_id = ? ORDER BY id ASC
  `).all(row.id) as Array<{
    id: number;
    severity: string;
    issue_type: string;
    field_path: string | null;
    message: string;
    created_at: string;
  }>;

  const matches = db.prepare(`
    SELECT m.*, w.title as existing_title FROM import_candidate_matches m
    LEFT JOIN works w ON w.id = m.existing_work_id
    WHERE m.candidate_id = ? ORDER BY m.score DESC
  `).all(row.id) as Array<{
    id: number;
    existing_work_id: string;
    existing_title: string | null;
    match_type: string;
    score: number;
    evidence_json: string;
    created_at: string;
  }>;

  return {
    id: row.id,
    jobId: row.job_id,
    sourceIndex: row.source_index,
    proposedWorkId: row.proposed_work_id,
    proposedTitle: row.proposed_title,
    parsed: JSON.parse(row.parsed_json) as Record<string, unknown>,
    status: row.status as CandidateStatus,
    action: row.action as CandidateAction,
    targetWorkId: row.target_work_id,
    resultWorkId: row.result_work_id,
    errorMessage: row.error_message,
    issues: issues.map((i) => ({
      id: i.id,
      severity: i.severity as CandidateIssueView["severity"],
      issueType: i.issue_type,
      fieldPath: i.field_path,
      message: i.message,
      createdAt: i.created_at
    })),
    matches: matches.map((m) => ({
      id: m.id,
      existingWorkId: m.existing_work_id,
      existingTitle: m.existing_title,
      matchType: m.match_type,
      score: m.score,
      evidence: JSON.parse(m.evidence_json) as Record<string, unknown>,
      createdAt: m.created_at
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function updateImportCandidate(
  db: SamDb,
  candidateId: string,
  patch: { action?: CandidateAction; targetWorkId?: string | null }
): ImportCandidateView {
  const row = db.prepare("SELECT * FROM import_candidates WHERE id = ?").get(candidateId) as CandidateRow | undefined;
  if (!row) throw new Error("Candidate not found");

  if (patch.action !== undefined && !isCandidateAction(patch.action)) {
    throw new Error(`Invalid candidate action: ${patch.action}`);
  }

  const action = patch.action ?? row.action as CandidateAction;
  const targetWorkId = patch.targetWorkId !== undefined ? patch.targetWorkId : row.target_work_id;
  const now = nowIso();

  db.prepare(`
    UPDATE import_candidates SET action = ?, target_work_id = ?, updated_at = ? WHERE id = ?
  `).run(action, targetWorkId, now, candidateId);

  const summary = computeJobSummary(db, row.job_id);
  const jobStatus = deriveJobStatus(summary);
  db.prepare(`
    UPDATE import_jobs SET status = ?, summary_json = ?, updated_at = ? WHERE id = ?
  `).run(jobStatus, JSON.stringify(summary), now, row.job_id);

  const updated = db.prepare("SELECT * FROM import_candidates WHERE id = ?").get(candidateId) as CandidateRow;
  return toCandidateView(db, updated);
}

export function canExecuteJob(db: SamDb, jobId: string): { ok: true } | { ok: false; reason: string } {
  const job = db.prepare("SELECT status FROM import_jobs WHERE id = ?").get(jobId) as { status: string } | undefined;
  if (!job) return { ok: false, reason: "Job not found" };
  if (job.status === "completed" || job.status === "executing") {
    return { ok: false, reason: "Job status does not allow execution" };
  }

  const candidates = db.prepare(`
    SELECT id, action, status FROM import_candidates WHERE job_id = ?
  `).all(jobId) as Array<{ id: string; action: string; status: string }>;

  if (candidates.length === 0) {
    return { ok: false, reason: "No candidates to execute" };
  }

  const executable = candidates.filter((c) => c.action !== "skip" && c.action !== "needs_review" && c.status !== "imported" && c.status !== "skipped");
  if (executable.length === 0) {
    return { ok: false, reason: "No executable candidates" };
  }

  for (const candidate of candidates) {
    if (candidate.action === "needs_review") {
      return { ok: false, reason: "Candidate requires review before execution" };
    }
    const errors = db.prepare(`
      SELECT COUNT(*) as count FROM import_candidate_issues
      WHERE candidate_id = ? AND severity = 'error'
    `).get(candidate.id) as { count: number };
    if (errors.count > 0 && candidate.action !== "skip") {
      return { ok: false, reason: "Candidate has blocking errors" };
    }
  }

  return { ok: true };
}

export function executeImportJob(
  db: SamDb,
  jobId: string,
  options: { actor?: string | null; databasePath: string }
): ImportJobView {
  const check = canExecuteJob(db, jobId);
  if (!check.ok) throw new Error(check.reason);

  const now = nowIso();
  db.prepare("UPDATE import_jobs SET status = 'executing', updated_at = ? WHERE id = ?").run(now, jobId);

  let backupFile: string | undefined;
  try {
    const backup = createDatabaseBackup(db, {
      databasePath: options.databasePath,
      reason: "before-import",
      actor: options.actor,
      relatedJobId: jobId
    });
    backupFile = backup.filePath;
  } catch (error) {
    db.prepare("UPDATE import_jobs SET status = 'failed', updated_at = ? WHERE id = ?").run(nowIso(), jobId);
    throw error;
  }

  const candidates = db.prepare(`
    SELECT * FROM import_candidates WHERE job_id = ? ORDER BY source_index ASC
  `).all(jobId) as CandidateRow[];

  const importedForRelations: Array<{ candidateId: string; resultWorkId: string; parsed: Record<string, unknown> }> = [];

  for (const row of candidates) {
    const action = row.action as CandidateAction;
    if (row.status === "imported" || row.status === "skipped") {
      continue;
    }

    if (action === "skip") {
      db.prepare(`
        UPDATE import_candidates SET status = 'skipped', updated_at = ? WHERE id = ?
      `).run(nowIso(), row.id);
      continue;
    }

    if (action === "needs_review") {
      continue;
    }

    try {
      const result = applyCandidateAction(db, row, action);
      const parsed = JSON.parse(row.parsed_json) as Record<string, unknown>;
      applyNestedEntities(db, result.id, parsed, { includeRelations: false });
      db.prepare(`
        UPDATE import_candidates SET status = 'imported', result_work_id = ?, updated_at = ? WHERE id = ?
      `).run(result.id, nowIso(), row.id);
      importedForRelations.push({ candidateId: row.id, resultWorkId: result.id, parsed });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      db.prepare(`
        UPDATE import_candidates SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?
      `).run(message, nowIso(), row.id);
    }
  }

  for (const item of importedForRelations) {
    try {
      applyNestedEntities(db, item.resultWorkId, item.parsed, { includeOnlyRelations: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import relations failed";
      db.prepare(`
        UPDATE import_candidates SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?
      `).run(message, nowIso(), item.candidateId);
    }
  }

  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) AS count FROM import_candidates WHERE job_id = ? GROUP BY status
  `).all(jobId) as Array<{ status: string; count: number }>;
  const countStatus = (status: CandidateStatus) => statusCounts.find((row) => row.status === status)?.count ?? 0;
  const successCount = countStatus("imported");
  const failedCount = countStatus("failed");
  const skippedCount = countStatus("skipped");

  const summary = {
    ...computeJobSummary(db, jobId),
    backupFile,
    successCount,
    failedCount,
    skipCount: skippedCount
  };

  const executedAt = nowIso();
  const finalStatus: ImportJobStatus = failedCount > 0 ? "failed" : "completed";
  db.prepare(`
    UPDATE import_jobs SET status = ?, summary_json = ?, executed_at = ?, updated_at = ? WHERE id = ?
  `).run(finalStatus, JSON.stringify(summary), executedAt, executedAt, jobId);

  return getImportJob(db, jobId)!;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null)
    : [];
}

function optionalText(value: unknown): string | null {
  return value === undefined || value === null || value === "" ? null : String(value);
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function applyNestedEntities(
  db: SamDb,
  workId: string,
  parsed: Record<string, unknown>,
  options: { includeRelations?: boolean; includeOnlyRelations?: boolean } = {}
): void {
  const includeOnlyRelations = options.includeOnlyRelations === true;
  const includeRelations = options.includeRelations !== false || includeOnlyRelations;

  if (!includeOnlyRelations) {
    for (const release of asRecordArray(parsed.releases)) {
      const releaseId = optionalText(release.releaseId ?? release.release_id);
      if (!releaseId) continue;
      createRelease(db, {
        releaseId,
        parentWorkId: workId,
        releaseTitle: optionalText(release.releaseTitle ?? release.release_title),
        releaseDate: optionalText(release.releaseDate ?? release.release_date),
        edition: optionalText(release.edition),
        episodeCount: optionalNumber(release.episodeCount ?? release.episode_count),
        duration: optionalText(release.duration),
        fileSize: optionalText(release.fileSize ?? release.file_size),
        resolution: optionalText(release.resolution),
        audioTracks: asRecordArray(release.audioTracks ?? release.audio_tracks),
        subtitleTracks: asRecordArray(release.subtitleTracks ?? release.subtitle_tracks),
        qualityNote: optionalText(release.qualityNote ?? release.quality_note),
        releaseStatus: (optionalText(release.releaseStatus ?? release.release_status) ?? "draft") as never
      });

      for (const entry of asRecordArray(release.accessEntries ?? release.access_entries)) {
        const accessId = optionalText(entry.accessId ?? entry.access_id);
        const accessType = optionalText(entry.accessType ?? entry.access_type);
        if (!accessId || !accessType) continue;
        createAccessEntry(db, {
          accessId,
          parentReleaseId: releaseId,
          accessType,
          platform: optionalText(entry.platform),
          url: optionalText(entry.url),
          availability: optionalText(entry.availability),
          accessNote: optionalText(entry.accessNote ?? entry.access_note),
          lastVerified: optionalText(entry.lastVerified ?? entry.last_verified),
          mirrorNote: optionalText(entry.mirrorNote ?? entry.mirror_note),
          accessRisk: optionalText(entry.accessRisk ?? entry.access_risk),
          checksum: optionalText(entry.checksum),
          extractCode: optionalText(entry.extractCode ?? entry.extract_code),
          internalPath: optionalText(entry.internalPath ?? entry.internal_path),
          sensitiveSource: optionalText(entry.sensitiveSource ?? entry.sensitive_source),
          visibility: (optionalText(entry.visibility) ?? "restricted") as never
        });
      }
    }

    for (const link of asRecordArray(parsed.externalLinks ?? parsed.external_links)) {
      const targetType = optionalText(link.targetType ?? link.target_type);
      if (!targetType) continue;
      createExternalLink(db, {
        workId,
        targetType,
        title: optionalText(link.title),
        url: optionalText(link.url),
        relationType: optionalText(link.relationType ?? link.relation_type),
        visibility: optionalText(link.visibility) ?? "public",
        note: optionalText(link.note)
      });
    }

    for (const source of asRecordArray(parsed.sources)) {
      createSource(db, {
        workId,
        sourceType: optionalText(source.sourceType ?? source.source_type),
        url: optionalText(source.url),
        title: optionalText(source.title),
        evidenceLevel: optionalText(source.evidenceLevel ?? source.evidence_level),
        note: optionalText(source.note),
        visibility: optionalText(source.visibility) ?? "public",
        lastChecked: optionalText(source.lastChecked ?? source.last_checked)
      });
    }

    for (const term of asRecordArray(parsed.taxonomyTerms ?? parsed.taxonomy_terms)) {
      const termId = optionalText(term.termId ?? term.term_id);
      if (!termId) continue;
      attachTermToWork(db, {
        workId,
        termId,
        relationType: optionalText(term.relationType ?? term.relation_type) ?? "tag",
        confidence: optionalText(term.confidence) ?? "imported",
        note: optionalText(term.note)
      });
    }

    for (const contributor of asRecordArray(parsed.contributors)) {
      const name = optionalText(contributor.name);
      const role = optionalText(contributor.role);
      if (!name || !role) continue;
      createContributor(db, {
        workId,
        name,
        role,
        creditName: optionalText(contributor.creditName ?? contributor.credit_name),
        note: optionalText(contributor.note),
        visibility: optionalText(contributor.visibility) ?? "public"
      });
    }

    for (const cover of asRecordArray(parsed.covers)) {
      const id = optionalText(cover.id);
      const url = optionalText(cover.url);
      if (!id || !url) continue;
      createCover(db, {
        id,
        workId,
        releaseId: optionalText(cover.releaseId ?? cover.release_id),
        url,
        source: optionalText(cover.source),
        isPrimary: cover.isPrimary === true || cover.is_primary === true || cover.isPrimary === "true" || cover.is_primary === "true",
        processNote: optionalText(cover.processNote ?? cover.process_note),
        visibility: optionalText(cover.visibility) ?? "public"
      });
    }
  }

  if (!includeRelations) return;

  for (const relation of asRecordArray(parsed.relations)) {
    const targetWorkId = optionalText(relation.targetWorkId ?? relation.target_work_id);
    const relationType = optionalText(relation.relationType ?? relation.relation_type);
    if (!targetWorkId || !relationType || !getWorkById(db, targetWorkId)) continue;
    createWorkRelation(db, {
      sourceWorkId: workId,
      targetWorkId,
      relationType: relationType as never,
      direction: (optionalText(relation.direction) ?? "directed") as never,
      note: optionalText(relation.note),
      confidence: optionalText(relation.confidence) ?? "imported",
      visibility: (optionalText(relation.visibility) ?? "public") as never
    });
  }
}

function applyCandidateAction(db: SamDb, row: CandidateRow, action: CandidateAction): WorkView {
  const parsed = JSON.parse(row.parsed_json) as Record<string, unknown>;
  const workInput = parsedToWorkInput(parsed);

  if (action === "create") {
    if (workInput.id && getWorkById(db, workInput.id)) {
      throw new Error(`Work id already exists: ${workInput.id}`);
    }
    return createWork(db, workInput);
  }

  const targetId = row.target_work_id;
  if (!targetId) throw new Error("target_work_id is required for overwrite/merge");

  const existing = getWorkById(db, targetId);
  if (!existing) throw new Error(`Target work not found: ${targetId}`);

  if (action === "overwrite") {
    return updateWork(db, targetId, workInput);
  }

  if (action === "merge") {
    return mergeWork(db, existing, workInput);
  }

  throw new Error(`Unsupported action: ${action}`);
}

function parsedToWorkInput(parsed: Record<string, unknown>): WorkInput {
  return {
    id: parsed.id != null && String(parsed.id).trim() ? String(parsed.id) : undefined,
    title: String(parsed.title ?? ""),
    titleI18n: asLocalizedObject(parsed.titleI18n),
    sourceLanguage: parsed.sourceLanguage != null ? String(parsed.sourceLanguage) : null,
    titleOriginal: parsed.titleOriginal != null ? String(parsed.titleOriginal) : null,
    aliases: asStringArray(parsed.aliases),
    series: parsed.series != null ? String(parsed.series) : null,
    language: parsed.language != null ? String(parsed.language) : null,
    year: parsed.year != null ? String(parsed.year) : null,
    summaryShort: String(parsed.summaryShort ?? ""),
    summaryShortI18n: asLocalizedObject(parsed.summaryShortI18n),
    summaryFull: parsed.summaryFull != null ? String(parsed.summaryFull) : null,
    summaryFullI18n: asLocalizedObject(parsed.summaryFullI18n),
    tags: asStringArray(parsed.tags),
    sourcePrimary: String(parsed.sourcePrimary ?? ""),
    recordStatus: (parsed.recordStatus ?? "draft") as WorkInput["recordStatus"],
    visibility: (parsed.visibility ?? "public") as WorkInput["visibility"],
    rightsNote: parsed.rightsNote != null ? String(parsed.rightsNote) : null,
    editor: parsed.editor != null ? String(parsed.editor) : null,
    reviewer: parsed.reviewer != null ? String(parsed.reviewer) : null
  };
}

function asLocalizedObject(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function mergeWork(db: SamDb, existing: WorkView, candidate: WorkInput): WorkView {
  const mergedAliases = [...new Set([...existing.aliases, ...candidate.aliases])];
  const mergedTags = [...new Set([...existing.tags, ...candidate.tags])];

  return updateWork(db, existing.id, {
    title: existing.title || candidate.title,
    titleI18n: { ...candidate.titleI18n, ...existing.titleI18n },
    sourceLanguage: existing.sourceLanguage ?? candidate.sourceLanguage,
    titleOriginal: existing.titleOriginal ?? candidate.titleOriginal,
    aliases: mergedAliases,
    series: existing.series ?? candidate.series,
    language: existing.language ?? candidate.language,
    year: existing.year ?? candidate.year,
    summaryShort: existing.summaryShort || candidate.summaryShort,
    summaryShortI18n: { ...candidate.summaryShortI18n, ...existing.summaryShortI18n },
    summaryFull: existing.summaryFull ?? candidate.summaryFull,
    summaryFullI18n: { ...candidate.summaryFullI18n, ...existing.summaryFullI18n },
    tags: mergedTags,
    sourcePrimary: existing.sourcePrimary || candidate.sourcePrimary,
    rightsNote: existing.rightsNote ?? candidate.rightsNote,
    editor: existing.editor ?? candidate.editor,
    reviewer: existing.reviewer ?? candidate.reviewer
  });
}

export function buildFieldComparison(
  db: SamDb,
  candidateId: string
): Array<{ field: string; candidate: unknown; existing: unknown }> | null {
  const row = db.prepare("SELECT * FROM import_candidates WHERE id = ?").get(candidateId) as CandidateRow | undefined;
  if (!row || !row.target_work_id) return null;

  const existing = getWorkById(db, row.target_work_id);
  if (!existing) return null;

  const parsed = JSON.parse(row.parsed_json) as Record<string, unknown>;
  const fields = ["id", "title", "titleOriginal", "aliases", "series", "language", "year",
    "summaryShort", "summaryFull", "tags", "sourcePrimary", "recordStatus", "visibility"];

  return fields.map((field) => ({
    field,
    candidate: parsed[field] ?? null,
    existing: (existing as Record<string, unknown>)[field] ?? null
  }));
}
