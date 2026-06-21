import { randomUUID } from "node:crypto";
import { workSchema, type WorkInput } from "@samdb/shared";
import type { SamDb } from "../db";
import { nowIso } from "../db";

type LocalizedText = Record<string, string>;

type WorkRow = {
  id: string;
  title: string;
  title_i18n_json: string | null;
  source_language: string | null;
  title_original: string | null;
  aliases_json: string | null;
  series: string | null;
  language: string | null;
  year: string | null;
  summary_short: string;
  summary_short_i18n_json: string | null;
  summary_full: string | null;
  summary_full_i18n_json: string | null;
  tags_json: string | null;
  source_primary: string;
  record_status: string;
  visibility: string;
  rights_note: string | null;
  editor: string | null;
  reviewer: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkView = {
  id: string;
  title: string;
  titleI18n: LocalizedText;
  sourceLanguage: string | null;
  titleOriginal: string | null;
  aliases: string[];
  series: string | null;
  language: string | null;
  year: string | null;
  summaryShort: string;
  summaryShortI18n: LocalizedText;
  summaryFull: string | null;
  summaryFullI18n: LocalizedText;
  tags: string[];
  sourcePrimary: string;
  recordStatus: string;
  visibility: string;
  rightsNote: string | null;
  editor: string | null;
  reviewer: string | null;
  createdAt: string;
  updatedAt: string;
};

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function parseLocalizedText(value: string | null): LocalizedText {
  if (!value) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function toWorkView(row: WorkRow): WorkView {
  return {
    id: row.id,
    title: row.title,
    titleI18n: parseLocalizedText(row.title_i18n_json),
    sourceLanguage: row.source_language,
    titleOriginal: row.title_original,
    aliases: parseJsonArray(row.aliases_json),
    series: row.series,
    language: row.language,
    year: row.year,
    summaryShort: row.summary_short,
    summaryShortI18n: parseLocalizedText(row.summary_short_i18n_json),
    summaryFull: row.summary_full,
    summaryFullI18n: parseLocalizedText(row.summary_full_i18n_json),
    tags: parseJsonArray(row.tags_json),
    sourcePrimary: row.source_primary,
    recordStatus: row.record_status,
    visibility: row.visibility,
    rightsNote: row.rights_note,
    editor: row.editor,
    reviewer: row.reviewer,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createWork(db: SamDb, input: WorkInput): WorkView {
  const parsed = workSchema.parse(input);
  const id = parsed.id ?? randomUUID();
  const now = nowIso();

  db.prepare(`
    INSERT INTO works (
      id, title, title_i18n_json, source_language, title_original, aliases_json, series, language, year,
      summary_short, summary_short_i18n_json, summary_full, summary_full_i18n_json, tags_json, source_primary, record_status,
      visibility, rights_note, editor, reviewer, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `).run(
    id,
    parsed.title,
    JSON.stringify(parsed.titleI18n ?? {}),
    parsed.sourceLanguage ?? null,
    parsed.titleOriginal ?? null,
    JSON.stringify(parsed.aliases),
    parsed.series ?? null,
    parsed.language ?? null,
    parsed.year ?? null,
    parsed.summaryShort,
    JSON.stringify(parsed.summaryShortI18n ?? {}),
    parsed.summaryFull ?? null,
    JSON.stringify(parsed.summaryFullI18n ?? {}),
    JSON.stringify(parsed.tags),
    parsed.sourcePrimary,
    parsed.recordStatus,
    parsed.visibility,
    parsed.rightsNote ?? null,
    parsed.editor ?? null,
    parsed.reviewer ?? null,
    now,
    now
  );

  const created = getWorkById(db, id);
  if (!created) throw new Error("Work was not created");
  return created;
}

export function listWorks(db: SamDb, options: { q?: string }): { items: WorkView[] } {
  const q = options.q?.trim();
  const rows = q
    ? db.prepare(`
        SELECT * FROM works
        WHERE title LIKE ? OR title_i18n_json LIKE ? OR aliases_json LIKE ? OR tags_json LIKE ?
        ORDER BY updated_at DESC
      `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) as WorkRow[]
    : db.prepare("SELECT * FROM works ORDER BY updated_at DESC").all() as WorkRow[];

  return { items: rows.map(toWorkView) };
}

export function listPublicWorks(db: SamDb, options: { q?: string }): { items: WorkView[] } {
  const q = options.q?.trim();
  const rows = q
    ? db.prepare(`
        SELECT * FROM works
        WHERE record_status = 'published'
          AND visibility = 'public'
          AND (
            title LIKE ?
            OR title_i18n_json LIKE ?
            OR aliases_json LIKE ?
            OR tags_json LIKE ?
            OR EXISTS (
              SELECT 1 FROM contributors
              WHERE contributors.work_id = works.id
                AND contributors.visibility = 'public'
                AND (
                  contributors.name LIKE ?
                  OR contributors.credit_name LIKE ?
                )
            )
          )
        ORDER BY updated_at DESC
      `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) as WorkRow[]
    : db.prepare(`
        SELECT * FROM works
        WHERE record_status = 'published'
          AND visibility = 'public'
        ORDER BY updated_at DESC
      `).all() as WorkRow[];

  return { items: rows.map(toWorkView) };
}

export function getWorkById(db: SamDb, id: string): WorkView | null {
  const row = db.prepare("SELECT * FROM works WHERE id = ?").get(id) as WorkRow | undefined;
  return row ? toWorkView(row) : null;
}

export function updateWork(db: SamDb, id: string, input: Partial<WorkInput>): WorkView {
  const existing = getWorkById(db, id);
  if (!existing) throw new Error(`Work not found: ${id}`);

  const merged = workSchema.parse({
    id,
    title: input.title ?? existing.title,
    titleI18n: input.titleI18n ?? existing.titleI18n,
    sourceLanguage: input.sourceLanguage ?? existing.sourceLanguage,
    titleOriginal: input.titleOriginal ?? existing.titleOriginal,
    aliases: input.aliases ?? existing.aliases,
    series: input.series ?? existing.series,
    language: input.language ?? existing.language,
    year: input.year ?? existing.year,
    summaryShort: input.summaryShort ?? existing.summaryShort,
    summaryShortI18n: input.summaryShortI18n ?? existing.summaryShortI18n,
    summaryFull: input.summaryFull ?? existing.summaryFull,
    summaryFullI18n: input.summaryFullI18n ?? existing.summaryFullI18n,
    tags: input.tags ?? existing.tags,
    sourcePrimary: input.sourcePrimary ?? existing.sourcePrimary,
    recordStatus: input.recordStatus ?? existing.recordStatus,
    visibility: input.visibility ?? existing.visibility,
    rightsNote: input.rightsNote ?? existing.rightsNote,
    editor: input.editor ?? existing.editor,
    reviewer: input.reviewer ?? existing.reviewer
  });

  db.prepare(`
    UPDATE works SET
      title = ?,
      title_i18n_json = ?,
      source_language = ?,
      title_original = ?,
      aliases_json = ?,
      series = ?,
      language = ?,
      year = ?,
      summary_short = ?,
      summary_short_i18n_json = ?,
      summary_full = ?,
      summary_full_i18n_json = ?,
      tags_json = ?,
      source_primary = ?,
      record_status = ?,
      visibility = ?,
      rights_note = ?,
      editor = ?,
      reviewer = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    merged.title,
    JSON.stringify(merged.titleI18n ?? {}),
    merged.sourceLanguage ?? null,
    merged.titleOriginal ?? null,
    JSON.stringify(merged.aliases),
    merged.series ?? null,
    merged.language ?? null,
    merged.year ?? null,
    merged.summaryShort,
    JSON.stringify(merged.summaryShortI18n ?? {}),
    merged.summaryFull ?? null,
    JSON.stringify(merged.summaryFullI18n ?? {}),
    JSON.stringify(merged.tags),
    merged.sourcePrimary,
    merged.recordStatus,
    merged.visibility,
    merged.rightsNote ?? null,
    merged.editor ?? null,
    merged.reviewer ?? null,
    nowIso(),
    id
  );

  const updated = getWorkById(db, id);
  if (!updated) throw new Error("Work disappeared after update");
  return updated;
}

export function deleteWork(db: SamDb, id: string): void {
  db.prepare("DELETE FROM works WHERE id = ?").run(id);
}
