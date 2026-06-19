import { releaseSchema, type ReleaseInput } from "@samdb/shared";
import type { SamDb } from "../db";
import { nowIso } from "../db";

type ReleaseRow = {
  release_id: string;
  parent_work_id: string;
  release_title: string | null;
  release_date: string | null;
  edition: string | null;
  episode_count: number | null;
  duration: string | null;
  file_size: string | null;
  resolution: string | null;
  audio_tracks_json: string | null;
  subtitle_tracks_json: string | null;
  cover_variant_id: string | null;
  quality_note: string | null;
  release_status: string;
  created_at: string;
  updated_at: string;
};

export type ReleaseView = {
  releaseId: string;
  parentWorkId: string;
  releaseTitle: string | null;
  releaseDate: string | null;
  edition: string | null;
  episodeCount: number | null;
  duration: string | null;
  fileSize: string | null;
  resolution: string | null;
  audioTracks: Array<Record<string, unknown>>;
  subtitleTracks: Array<Record<string, unknown>>;
  coverVariantId: string | null;
  qualityNote: string | null;
  releaseStatus: string;
  createdAt: string;
  updatedAt: string;
};

function parseJsonList(value: string | null): Array<Record<string, unknown>> {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
}

function toReleaseView(row: ReleaseRow): ReleaseView {
  return {
    releaseId: row.release_id,
    parentWorkId: row.parent_work_id,
    releaseTitle: row.release_title,
    releaseDate: row.release_date,
    edition: row.edition,
    episodeCount: row.episode_count,
    duration: row.duration,
    fileSize: row.file_size,
    resolution: row.resolution,
    audioTracks: parseJsonList(row.audio_tracks_json),
    subtitleTracks: parseJsonList(row.subtitle_tracks_json),
    coverVariantId: row.cover_variant_id,
    qualityNote: row.quality_note,
    releaseStatus: row.release_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createRelease(db: SamDb, input: ReleaseInput): ReleaseView {
  const parsed = releaseSchema.parse(input);
  const now = nowIso();

  db.prepare(`
    INSERT INTO releases (
      release_id, parent_work_id, release_title, release_date, edition,
      episode_count, duration, file_size, resolution, audio_tracks_json,
      subtitle_tracks_json, quality_note, release_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    parsed.releaseId,
    parsed.parentWorkId,
    parsed.releaseTitle ?? null,
    parsed.releaseDate ?? null,
    parsed.edition ?? null,
    parsed.episodeCount ?? null,
    parsed.duration ?? null,
    parsed.fileSize ?? null,
    parsed.resolution ?? null,
    JSON.stringify(parsed.audioTracks),
    JSON.stringify(parsed.subtitleTracks),
    parsed.qualityNote ?? null,
    parsed.releaseStatus,
    now,
    now
  );

  const created = getReleaseById(db, parsed.releaseId);
  if (!created) throw new Error("Release was not created");
  return created;
}

export function getReleaseById(db: SamDb, releaseId: string): ReleaseView | null {
  const row = db.prepare("SELECT * FROM releases WHERE release_id = ?").get(releaseId) as ReleaseRow | undefined;
  return row ? toReleaseView(row) : null;
}

export function updateRelease(db: SamDb, releaseId: string, input: Partial<Omit<ReleaseInput, "releaseId" | "parentWorkId">>): ReleaseView {
  const existing = getReleaseById(db, releaseId);
  if (!existing) throw new Error(`Release not found: ${releaseId}`);

  db.prepare(`
    UPDATE releases SET
      release_title = ?,
      release_date = ?,
      edition = ?,
      episode_count = ?,
      duration = ?,
      file_size = ?,
      resolution = ?,
      audio_tracks_json = ?,
      subtitle_tracks_json = ?,
      quality_note = ?,
      release_status = ?,
      updated_at = ?
    WHERE release_id = ?
  `).run(
    input.releaseTitle ?? existing.releaseTitle,
    input.releaseDate ?? existing.releaseDate,
    input.edition ?? existing.edition,
    input.episodeCount ?? existing.episodeCount,
    input.duration ?? existing.duration,
    input.fileSize ?? existing.fileSize,
    input.resolution ?? existing.resolution,
    JSON.stringify(input.audioTracks ?? existing.audioTracks),
    JSON.stringify(input.subtitleTracks ?? existing.subtitleTracks),
    input.qualityNote ?? existing.qualityNote,
    input.releaseStatus ?? existing.releaseStatus,
    nowIso(),
    releaseId
  );

  const updated = getReleaseById(db, releaseId);
  if (!updated) throw new Error("Release disappeared after update");
  return updated;
}

export function deleteRelease(db: SamDb, releaseId: string): ReleaseView {
  const existing = getReleaseById(db, releaseId);
  if (!existing) throw new Error(`Release not found: ${releaseId}`);
  db.prepare("DELETE FROM releases WHERE release_id = ?").run(releaseId);
  return existing;
}

export function listReleasesForWork(db: SamDb, workId: string): ReleaseView[] {
  const rows = db.prepare(`
    SELECT * FROM releases
    WHERE parent_work_id = ?
    ORDER BY release_date DESC, created_at DESC
  `).all(workId) as ReleaseRow[];
  return rows.map(toReleaseView);
}

export function listPublicReleasesForWork(db: SamDb, workId: string): ReleaseView[] {
  const rows = db.prepare(`
    SELECT * FROM releases
    WHERE parent_work_id = ?
      AND release_status IN ('published', 'available')
    ORDER BY release_date DESC, created_at DESC
  `).all(workId) as ReleaseRow[];
  return rows.map(toReleaseView);
}
