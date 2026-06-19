import type { SamDb } from "../db";
import { nowIso } from "../db";

export type WorkTaxonomyAttachmentInput = {
  workId: string;
  termId: string;
  relationType?: string;
  confidence?: string;
  note?: string | null;
};

export type WorkTaxonomyAttachmentView = {
  id: number;
  work_id: string;
  term_id: string;
  relation_type: string;
  confidence: string;
  note: string | null;
  created_at: string;
};

export function attachTermToWork(db: SamDb, input: WorkTaxonomyAttachmentInput): WorkTaxonomyAttachmentView {
  const now = nowIso();
  const result = db.prepare(`
    INSERT INTO work_taxonomy_terms (
      work_id, term_id, relation_type, confidence, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    input.workId,
    input.termId,
    input.relationType ?? "tag",
    input.confidence ?? "manual",
    input.note ?? null,
    now
  ) as { lastInsertRowid?: number | bigint };

  const attached = getWorkTaxonomyAttachmentById(db, Number(result.lastInsertRowid));
  if (!attached) throw new Error("Work taxonomy attachment was not created");
  return attached;
}

export function getWorkTaxonomyAttachmentById(db: SamDb, attachmentId: number): WorkTaxonomyAttachmentView | null {
  const row = db.prepare("SELECT * FROM work_taxonomy_terms WHERE id = ?").get(attachmentId) as WorkTaxonomyAttachmentView | undefined;
  return row ?? null;
}

export function detachTermFromWork(db: SamDb, attachmentId: number): WorkTaxonomyAttachmentView {
  const existing = getWorkTaxonomyAttachmentById(db, attachmentId);
  if (!existing) throw new Error(`Work taxonomy attachment not found: ${attachmentId}`);
  db.prepare("DELETE FROM work_taxonomy_terms WHERE id = ?").run(attachmentId);
  return existing;
}

export function listTermsForWork(db: SamDb, workId: string) {
  return db.prepare(`
    SELECT
      work_taxonomy_terms.id,
      work_taxonomy_terms.work_id,
      work_taxonomy_terms.term_id,
      work_taxonomy_terms.relation_type,
      work_taxonomy_terms.confidence,
      work_taxonomy_terms.note,
      work_taxonomy_terms.created_at,
      taxonomy_terms.label,
      taxonomy_terms.slug,
      taxonomies.code AS taxonomy_code,
      taxonomies.name AS taxonomy_name
    FROM work_taxonomy_terms
    JOIN taxonomy_terms ON taxonomy_terms.id = work_taxonomy_terms.term_id
    JOIN taxonomies ON taxonomies.id = taxonomy_terms.taxonomy_id
    WHERE work_taxonomy_terms.work_id = ?
    ORDER BY taxonomies.code, taxonomy_terms.label
  `).all(workId);
}
