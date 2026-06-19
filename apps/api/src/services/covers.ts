import type { SamDb } from "../db";
import { nowIso } from "../db";

type CoverRow = {
  id: string;
  work_id: string;
  release_id: string | null;
  url: string;
  source: string | null;
  is_primary: number;
  process_note: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
};

export type CoverView = {
  id: string;
  workId: string;
  releaseId: string | null;
  url: string;
  source: string | null;
  isPrimary: boolean;
  processNote: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
};

export type CoverInput = {
  id: string;
  workId: string;
  releaseId?: string | null;
  url: string;
  source?: string | null;
  isPrimary?: boolean;
  processNote?: string | null;
  visibility?: string;
};

function toCoverView(row: CoverRow): CoverView {
  return {
    id: row.id,
    workId: row.work_id,
    releaseId: row.release_id,
    url: row.url,
    source: row.source,
    isPrimary: row.is_primary === 1,
    processNote: row.process_note,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createCover(db: SamDb, input: CoverInput): CoverView {
  const now = nowIso();
  db.prepare(`
    INSERT INTO covers (
      id, work_id, release_id, url, source, is_primary, process_note,
      visibility, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.workId,
    input.releaseId ?? null,
    input.url,
    input.source ?? null,
    input.isPrimary ? 1 : 0,
    input.processNote ?? null,
    input.visibility ?? "public",
    now,
    now
  );

  const created = getCoverById(db, input.id);
  if (!created) throw new Error("Cover was not created");
  return created;
}

export function getCoverById(db: SamDb, id: string): CoverView | null {
  const row = db.prepare("SELECT * FROM covers WHERE id = ?").get(id) as CoverRow | undefined;
  return row ? toCoverView(row) : null;
}

export function updateCover(db: SamDb, id: string, input: Partial<Omit<CoverInput, "id" | "workId">>): CoverView {
  const existing = getCoverById(db, id);
  if (!existing) throw new Error(`Cover not found: ${id}`);

  db.prepare(`
    UPDATE covers SET
      release_id = ?,
      url = ?,
      source = ?,
      is_primary = ?,
      process_note = ?,
      visibility = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    input.releaseId ?? existing.releaseId,
    input.url ?? existing.url,
    input.source ?? existing.source,
    input.isPrimary === undefined ? (existing.isPrimary ? 1 : 0) : (input.isPrimary ? 1 : 0),
    input.processNote ?? existing.processNote,
    input.visibility ?? existing.visibility,
    nowIso(),
    id
  );

  const updated = getCoverById(db, id);
  if (!updated) throw new Error("Cover disappeared after update");
  return updated;
}

export function deleteCover(db: SamDb, id: string): CoverView {
  const existing = getCoverById(db, id);
  if (!existing) throw new Error(`Cover not found: ${id}`);
  db.prepare("DELETE FROM covers WHERE id = ?").run(id);
  return existing;
}

export function listCoversForWork(db: SamDb, workId: string): CoverView[] {
  const rows = db.prepare(`
    SELECT * FROM covers
    WHERE work_id = ?
    ORDER BY is_primary DESC, created_at DESC
  `).all(workId) as CoverRow[];
  return rows.map(toCoverView);
}

export function listPublicCoversForWork(db: SamDb, workId: string): CoverView[] {
  return listCoversForWork(db, workId).filter((cover) => cover.visibility === "public");
}
