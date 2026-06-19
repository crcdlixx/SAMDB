import type { SamDb } from "../db";
import { nowIso } from "../db";

type ContributorRow = {
  id: number;
  work_id: string;
  name: string;
  role: string;
  credit_name: string | null;
  note: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
};

export type ContributorView = {
  id: number;
  workId: string;
  name: string;
  role: string;
  creditName: string | null;
  note: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
};

export type ContributorInput = {
  workId: string;
  name: string;
  role: string;
  creditName?: string | null;
  note?: string | null;
  visibility?: string;
};

function toContributorView(row: ContributorRow): ContributorView {
  return {
    id: row.id,
    workId: row.work_id,
    name: row.name,
    role: row.role,
    creditName: row.credit_name,
    note: row.note,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createContributor(db: SamDb, input: ContributorInput): ContributorView {
  const now = nowIso();
  const result = db.prepare(`
    INSERT INTO contributors (
      work_id, name, role, credit_name, note, visibility, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.workId,
    input.name,
    input.role,
    input.creditName ?? null,
    input.note ?? null,
    input.visibility ?? "public",
    now,
    now
  ) as { lastInsertRowid?: number | bigint };

  const created = getContributorById(db, Number(result.lastInsertRowid));
  if (!created) throw new Error("Contributor was not created");
  return created;
}

export function getContributorById(db: SamDb, id: number): ContributorView | null {
  const row = db.prepare("SELECT * FROM contributors WHERE id = ?").get(id) as ContributorRow | undefined;
  return row ? toContributorView(row) : null;
}

export function updateContributor(db: SamDb, id: number, input: Partial<Omit<ContributorInput, "workId">>): ContributorView {
  const existing = getContributorById(db, id);
  if (!existing) throw new Error(`Contributor not found: ${id}`);

  db.prepare(`
    UPDATE contributors SET
      name = ?,
      role = ?,
      credit_name = ?,
      note = ?,
      visibility = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    input.name ?? existing.name,
    input.role ?? existing.role,
    input.creditName ?? existing.creditName,
    input.note ?? existing.note,
    input.visibility ?? existing.visibility,
    nowIso(),
    id
  );

  const updated = getContributorById(db, id);
  if (!updated) throw new Error("Contributor disappeared after update");
  return updated;
}

export function deleteContributor(db: SamDb, id: number): ContributorView {
  const existing = getContributorById(db, id);
  if (!existing) throw new Error(`Contributor not found: ${id}`);
  db.prepare("DELETE FROM contributors WHERE id = ?").run(id);
  return existing;
}

export function listContributorsForWork(db: SamDb, workId: string): ContributorView[] {
  const rows = db.prepare(`
    SELECT * FROM contributors
    WHERE work_id = ?
    ORDER BY role, name
  `).all(workId) as ContributorRow[];
  return rows.map(toContributorView);
}

export function listPublicContributorsForWork(db: SamDb, workId: string): ContributorView[] {
  return listContributorsForWork(db, workId).filter((contributor) => contributor.visibility === "public");
}
