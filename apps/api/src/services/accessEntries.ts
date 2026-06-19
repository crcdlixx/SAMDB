import { accessEntrySchema, filterPublicAccessEntry, type AccessEntryInput } from "@samdb/shared";
import type { SamDb } from "../db";
import { nowIso } from "../db";

type AccessEntryRow = {
  access_id: string;
  parent_release_id: string;
  access_type: string;
  platform: string | null;
  url: string | null;
  availability: string | null;
  access_note: string | null;
  last_verified: string | null;
  mirror_note: string | null;
  access_risk: string | null;
  checksum: string | null;
  extract_code: string | null;
  internal_path: string | null;
  sensitive_source: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
};

export type AccessEntryView = {
  accessId: string;
  parentReleaseId: string;
  accessType: string;
  platform: string | null;
  url: string | null;
  availability: string | null;
  accessNote: string | null;
  lastVerified: string | null;
  mirrorNote: string | null;
  accessRisk: string | null;
  checksum: string | null;
  extractCode: string | null;
  internalPath: string | null;
  sensitiveSource: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicAccessEntryView = Partial<AccessEntryView>;

function toAccessEntryView(row: AccessEntryRow): AccessEntryView {
  return {
    accessId: row.access_id,
    parentReleaseId: row.parent_release_id,
    accessType: row.access_type,
    platform: row.platform,
    url: row.url,
    availability: row.availability,
    accessNote: row.access_note,
    lastVerified: row.last_verified,
    mirrorNote: row.mirror_note,
    accessRisk: row.access_risk,
    checksum: row.checksum,
    extractCode: row.extract_code,
    internalPath: row.internal_path,
    sensitiveSource: row.sensitive_source,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createAccessEntry(db: SamDb, input: AccessEntryInput): AccessEntryView {
  const parsed = accessEntrySchema.parse(input);
  const now = nowIso();

  db.prepare(`
    INSERT INTO access_entries (
      access_id, parent_release_id, access_type, platform, url,
      availability, access_note, last_verified, mirror_note, access_risk,
      checksum, extract_code, internal_path, sensitive_source, visibility,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    parsed.accessId,
    parsed.parentReleaseId,
    parsed.accessType,
    parsed.platform ?? null,
    parsed.url ?? null,
    parsed.availability ?? null,
    parsed.accessNote ?? null,
    parsed.lastVerified ?? null,
    parsed.mirrorNote ?? null,
    parsed.accessRisk ?? null,
    parsed.checksum ?? null,
    parsed.extractCode ?? null,
    parsed.internalPath ?? null,
    parsed.sensitiveSource ?? null,
    parsed.visibility,
    now,
    now
  );

  const created = getAccessEntryById(db, parsed.accessId);
  if (!created) throw new Error("Access entry was not created");
  return created;
}

export function getAccessEntryById(db: SamDb, accessId: string): AccessEntryView | null {
  const row = db.prepare("SELECT * FROM access_entries WHERE access_id = ?").get(accessId) as AccessEntryRow | undefined;
  return row ? toAccessEntryView(row) : null;
}

export function updateAccessEntry(db: SamDb, accessId: string, input: Partial<Omit<AccessEntryInput, "accessId" | "parentReleaseId">>): AccessEntryView {
  const existing = getAccessEntryById(db, accessId);
  if (!existing) throw new Error(`Access entry not found: ${accessId}`);

  db.prepare(`
    UPDATE access_entries SET
      access_type = ?,
      platform = ?,
      url = ?,
      availability = ?,
      access_note = ?,
      last_verified = ?,
      mirror_note = ?,
      access_risk = ?,
      checksum = ?,
      extract_code = ?,
      internal_path = ?,
      sensitive_source = ?,
      visibility = ?,
      updated_at = ?
    WHERE access_id = ?
  `).run(
    input.accessType ?? existing.accessType,
    input.platform ?? existing.platform,
    input.url ?? existing.url,
    input.availability ?? existing.availability,
    input.accessNote ?? existing.accessNote,
    input.lastVerified ?? existing.lastVerified,
    input.mirrorNote ?? existing.mirrorNote,
    input.accessRisk ?? existing.accessRisk,
    input.checksum ?? existing.checksum,
    input.extractCode ?? existing.extractCode,
    input.internalPath ?? existing.internalPath,
    input.sensitiveSource ?? existing.sensitiveSource,
    input.visibility ?? existing.visibility,
    nowIso(),
    accessId
  );

  const updated = getAccessEntryById(db, accessId);
  if (!updated) throw new Error("Access entry disappeared after update");
  return updated;
}

export function deleteAccessEntry(db: SamDb, accessId: string): AccessEntryView {
  const existing = getAccessEntryById(db, accessId);
  if (!existing) throw new Error(`Access entry not found: ${accessId}`);
  db.prepare("DELETE FROM access_entries WHERE access_id = ?").run(accessId);
  return existing;
}

export function listAccessEntriesForRelease(db: SamDb, releaseId: string): AccessEntryView[] {
  const rows = db.prepare(`
    SELECT * FROM access_entries
    WHERE parent_release_id = ?
    ORDER BY created_at DESC
  `).all(releaseId) as AccessEntryRow[];
  return rows.map(toAccessEntryView);
}

export function listPublicAccessEntriesForRelease(db: SamDb, releaseId: string): PublicAccessEntryView[] {
  return listAccessEntriesForRelease(db, releaseId).map((entry) => filterPublicAccessEntry(entry));
}
