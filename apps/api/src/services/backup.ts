import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { SamDb } from "../db";
import { nowIso } from "../db";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getDefaultDatabasePath(): string {
  return process.env.SAMDB_DATABASE_PATH ?? resolve(__dirname, "../../../../data/samdb.sqlite");
}

export type BackupSnapshotView = {
  id: string;
  filePath: string;
  reason: string;
  actor: string | null;
  relatedJobId: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

type BackupRow = {
  id: string;
  file_path: string;
  reason: string;
  actor: string | null;
  related_job_id: string | null;
  size_bytes: number | null;
  created_at: string;
};

function toBackupView(row: BackupRow): BackupSnapshotView {
  return {
    id: row.id,
    filePath: row.file_path,
    reason: row.reason,
    actor: row.actor,
    relatedJobId: row.related_job_id,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at
  };
}

function formatBackupTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function createDatabaseBackup(
  db: SamDb,
  options: {
    databasePath: string;
    reason: string;
    actor?: string | null;
    relatedJobId?: string | null;
  }
): BackupSnapshotView {
  const { databasePath, reason, actor, relatedJobId } = options;

  if (databasePath === ":memory:") {
    throw new Error("Cannot backup in-memory database");
  }

  const backupDir = resolve(dirname(databasePath), "backups");
  mkdirSync(backupDir, { recursive: true });

  const timestamp = formatBackupTimestamp(new Date());
  const jobSuffix = relatedJobId ? `-before-import-${relatedJobId}` : "";
  const fileName = `samdb-${timestamp}${jobSuffix}.sqlite`;
  const backupPath = resolve(backupDir, fileName);

  copyFileSync(databasePath, backupPath);
  const sizeBytes = statSync(backupPath).size;
  const id = randomUUID();
  const createdAt = nowIso();

  db.prepare(`
    INSERT INTO backup_snapshots (id, file_path, reason, actor, related_job_id, size_bytes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, backupPath, reason, actor ?? null, relatedJobId ?? null, sizeBytes, createdAt);

  const row = db.prepare("SELECT * FROM backup_snapshots WHERE id = ?").get(id) as BackupRow;
  return toBackupView(row);
}

export function listBackupSnapshots(db: SamDb): { items: BackupSnapshotView[] } {
  const rows = db.prepare(`
    SELECT * FROM backup_snapshots ORDER BY created_at DESC
  `).all() as BackupRow[];
  return { items: rows.map(toBackupView) };
}
