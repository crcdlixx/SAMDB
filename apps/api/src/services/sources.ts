import type { SamDb } from "../db";
import { nowIso } from "../db";

type SourceRow = {
  id: number;
  work_id: string;
  source_type: string | null;
  url: string | null;
  title: string | null;
  evidence_level: string | null;
  note: string | null;
  visibility: string;
  last_checked: string | null;
  created_at: string;
  updated_at: string;
};

export type SourceView = {
  id: number;
  workId: string;
  sourceType: string | null;
  url: string | null;
  title: string | null;
  evidenceLevel: string | null;
  note: string | null;
  visibility: string;
  lastChecked: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SourceInput = {
  workId: string;
  sourceType?: string | null;
  url?: string | null;
  title?: string | null;
  evidenceLevel?: string | null;
  note?: string | null;
  visibility?: string;
  lastChecked?: string | null;
};

function toSourceView(row: SourceRow): SourceView {
  return {
    id: row.id,
    workId: row.work_id,
    sourceType: row.source_type,
    url: row.url,
    title: row.title,
    evidenceLevel: row.evidence_level,
    note: row.note,
    visibility: row.visibility,
    lastChecked: row.last_checked,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createSource(db: SamDb, input: SourceInput): SourceView {
  const now = nowIso();
  const result = db.prepare(`
    INSERT INTO sources (
      work_id, source_type, url, title, evidence_level, note,
      visibility, last_checked, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.workId,
    input.sourceType ?? null,
    input.url ?? null,
    input.title ?? null,
    input.evidenceLevel ?? null,
    input.note ?? null,
    input.visibility ?? "public",
    input.lastChecked ?? null,
    now,
    now
  ) as { lastInsertRowid?: number | bigint };

  const created = getSourceById(db, Number(result.lastInsertRowid));
  if (!created) throw new Error("Source was not created");
  return created;
}

export function getSourceById(db: SamDb, id: number): SourceView | null {
  const row = db.prepare("SELECT * FROM sources WHERE id = ?").get(id) as SourceRow | undefined;
  return row ? toSourceView(row) : null;
}

export function updateSource(db: SamDb, id: number, input: Partial<Omit<SourceInput, "workId">>): SourceView {
  const existing = getSourceById(db, id);
  if (!existing) throw new Error(`Source not found: ${id}`);

  db.prepare(`
    UPDATE sources SET
      source_type = ?,
      url = ?,
      title = ?,
      evidence_level = ?,
      note = ?,
      visibility = ?,
      last_checked = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    input.sourceType ?? existing.sourceType,
    input.url ?? existing.url,
    input.title ?? existing.title,
    input.evidenceLevel ?? existing.evidenceLevel,
    input.note ?? existing.note,
    input.visibility ?? existing.visibility,
    input.lastChecked ?? existing.lastChecked,
    nowIso(),
    id
  );

  const updated = getSourceById(db, id);
  if (!updated) throw new Error("Source disappeared after update");
  return updated;
}

export function deleteSource(db: SamDb, id: number): SourceView {
  const existing = getSourceById(db, id);
  if (!existing) throw new Error(`Source not found: ${id}`);
  db.prepare("DELETE FROM sources WHERE id = ?").run(id);
  return existing;
}

export function listSourcesForWork(db: SamDb, workId: string): SourceView[] {
  const rows = db.prepare(`
    SELECT * FROM sources
    WHERE work_id = ?
    ORDER BY created_at DESC
  `).all(workId) as SourceRow[];
  return rows.map(toSourceView);
}

export function listPublicSourcesForWork(db: SamDb, workId: string): SourceView[] {
  return listSourcesForWork(db, workId).filter((source) => source.visibility === "public");
}
