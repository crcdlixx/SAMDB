import { workSchema, type WorkInput } from "@samdb/shared";
import type { SamDb } from "../db";
import { nowIso } from "../db";

type WorkRow = {
  id: string;
  title: string;
  title_original: string | null;
  aliases_json: string | null;
  series: string | null;
  language: string | null;
  year: string | null;
  summary_short: string;
  summary_full: string | null;
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
  titleOriginal: string | null;
  aliases: string[];
  series: string | null;
  language: string | null;
  year: string | null;
  summaryShort: string;
  summaryFull: string | null;
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

function toWorkView(row: WorkRow): WorkView {
  return {
    id: row.id,
    title: row.title,
    titleOriginal: row.title_original,
    aliases: parseJsonArray(row.aliases_json),
    series: row.series,
    language: row.language,
    year: row.year,
    summaryShort: row.summary_short,
    summaryFull: row.summary_full,
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
  const now = nowIso();

  db.prepare(`
    INSERT INTO works (
      id, title, title_original, aliases_json, series, language, year,
      summary_short, summary_full, tags_json, source_primary, record_status,
      visibility, rights_note, editor, reviewer, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `).run(
    parsed.id,
    parsed.title,
    parsed.titleOriginal ?? null,
    JSON.stringify(parsed.aliases),
    parsed.series ?? null,
    parsed.language ?? null,
    parsed.year ?? null,
    parsed.summaryShort,
    parsed.summaryFull ?? null,
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

  const created = getWorkById(db, parsed.id);
  if (!created) throw new Error("Work was not created");
  return created;
}

export function listWorks(db: SamDb, options: { q?: string }): { items: WorkView[] } {
  const q = options.q?.trim();
  const rows = q
    ? db.prepare(`
        SELECT * FROM works
        WHERE title LIKE ? OR aliases_json LIKE ?
        ORDER BY updated_at DESC
      `).all(`%${q}%`, `%${q}%`) as WorkRow[]
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
      `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) as WorkRow[]
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
    titleOriginal: input.titleOriginal ?? existing.titleOriginal,
    aliases: input.aliases ?? existing.aliases,
    series: input.series ?? existing.series,
    language: input.language ?? existing.language,
    year: input.year ?? existing.year,
    summaryShort: input.summaryShort ?? existing.summaryShort,
    summaryFull: input.summaryFull ?? existing.summaryFull,
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
      title_original = ?,
      aliases_json = ?,
      series = ?,
      language = ?,
      year = ?,
      summary_short = ?,
      summary_full = ?,
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
    merged.titleOriginal ?? null,
    JSON.stringify(merged.aliases),
    merged.series ?? null,
    merged.language ?? null,
    merged.year ?? null,
    merged.summaryShort,
    merged.summaryFull ?? null,
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
