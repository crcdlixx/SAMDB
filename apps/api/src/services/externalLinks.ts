import type { SamDb } from "../db";
import { nowIso } from "../db";

type ExternalLinkRow = {
  id: number;
  work_id: string;
  target_type: string;
  title: string | null;
  url: string | null;
  relation_type: string | null;
  visibility: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ExternalLinkView = {
  id: number;
  workId: string;
  targetType: string;
  title: string | null;
  url: string | null;
  relationType: string | null;
  visibility: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExternalLinkInput = {
  workId: string;
  targetType: string;
  title?: string | null;
  url?: string | null;
  relationType?: string | null;
  visibility?: string;
  note?: string | null;
};

function toExternalLinkView(row: ExternalLinkRow): ExternalLinkView {
  return {
    id: row.id,
    workId: row.work_id,
    targetType: row.target_type,
    title: row.title,
    url: row.url,
    relationType: row.relation_type,
    visibility: row.visibility,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createExternalLink(db: SamDb, input: ExternalLinkInput): ExternalLinkView {
  const now = nowIso();
  const result = db.prepare(`
    INSERT INTO external_links (
      work_id, target_type, title, url, relation_type,
      visibility, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.workId,
    input.targetType,
    input.title ?? null,
    input.url ?? null,
    input.relationType ?? null,
    input.visibility ?? "public",
    input.note ?? null,
    now,
    now
  ) as { lastInsertRowid?: number | bigint };

  const created = getExternalLinkById(db, Number(result.lastInsertRowid));
  if (!created) throw new Error("External link was not created");
  return created;
}

export function getExternalLinkById(db: SamDb, id: number): ExternalLinkView | null {
  const row = db.prepare("SELECT * FROM external_links WHERE id = ?").get(id) as ExternalLinkRow | undefined;
  return row ? toExternalLinkView(row) : null;
}

export function updateExternalLink(db: SamDb, id: number, input: Partial<Omit<ExternalLinkInput, "workId">>): ExternalLinkView {
  const existing = getExternalLinkById(db, id);
  if (!existing) throw new Error(`External link not found: ${id}`);

  db.prepare(`
    UPDATE external_links SET
      target_type = ?,
      title = ?,
      url = ?,
      relation_type = ?,
      visibility = ?,
      note = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    input.targetType ?? existing.targetType,
    input.title ?? existing.title,
    input.url ?? existing.url,
    input.relationType ?? existing.relationType,
    input.visibility ?? existing.visibility,
    input.note ?? existing.note,
    nowIso(),
    id
  );

  const updated = getExternalLinkById(db, id);
  if (!updated) throw new Error("External link disappeared after update");
  return updated;
}

export function deleteExternalLink(db: SamDb, id: number): ExternalLinkView {
  const existing = getExternalLinkById(db, id);
  if (!existing) throw new Error(`External link not found: ${id}`);
  db.prepare("DELETE FROM external_links WHERE id = ?").run(id);
  return existing;
}

export function listExternalLinksForWork(db: SamDb, workId: string): ExternalLinkView[] {
  const rows = db.prepare(`
    SELECT * FROM external_links
    WHERE work_id = ?
    ORDER BY target_type, title
  `).all(workId) as ExternalLinkRow[];
  return rows.map(toExternalLinkView);
}

export function listPublicExternalLinksForWork(db: SamDb, workId: string): ExternalLinkView[] {
  return listExternalLinksForWork(db, workId).filter((link) => link.visibility === "public");
}
