import type { SamDb } from "../db";
import { nowIso } from "../db";

export function createTaxonomy(db: SamDb, input: { id: string; code: string; name: string; description?: string }) {
  const now = nowIso();
  db.prepare(`
    INSERT INTO taxonomies (id, code, name, description, is_system, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(input.id, input.code, input.name, input.description ?? null, now, now);
}

export function listTaxonomies(db: SamDb) {
  return db.prepare("SELECT * FROM taxonomies ORDER BY code").all();
}

export function createTerm(db: SamDb, input: { id: string; taxonomyId: string; parentId?: string | null; label: string; slug: string; description?: string }) {
  const now = nowIso();
  db.prepare(`
    INSERT INTO taxonomy_terms (id, taxonomy_id, parent_id, label, slug, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(input.id, input.taxonomyId, input.parentId ?? null, input.label, input.slug, input.description ?? null, now, now);
}

export function listTermsByTaxonomyCode(db: SamDb, code: string) {
  return db.prepare(`
    SELECT taxonomy_terms.*
    FROM taxonomy_terms
    JOIN taxonomies ON taxonomies.id = taxonomy_terms.taxonomy_id
    WHERE taxonomies.code = ?
    ORDER BY taxonomy_terms.sort_order, taxonomy_terms.label
  `).all(code);
}
