import type { SamDb } from "../db";
import { nowIso } from "../db";

type AuditLogRow = {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string | null;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
};

export type AuditLogView = {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  actor: string | null;
  before: unknown | null;
  after: unknown | null;
  createdAt: string;
};

type CreateAuditLogInput = {
  entityType: string;
  entityId: string;
  action: string;
  actor?: string | null;
  before?: unknown;
  after?: unknown;
};

function parseJson(value: string | null): unknown | null {
  if (!value) return null;
  return JSON.parse(value) as unknown;
}

function toAuditLogView(row: AuditLogRow): AuditLogView {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    actor: row.actor,
    before: parseJson(row.before_json),
    after: parseJson(row.after_json),
    createdAt: row.created_at
  };
}

export function createAuditLog(db: SamDb, input: CreateAuditLogInput): AuditLogView {
  const createdAt = nowIso();

  const result = db.prepare(`
    INSERT INTO audit_logs (
      entity_type, entity_id, action, actor, before_json, after_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.entityType,
    input.entityId,
    input.action,
    input.actor ?? "local",
    input.before === undefined ? null : JSON.stringify(input.before),
    input.after === undefined ? null : JSON.stringify(input.after),
    createdAt
  ) as { lastInsertRowid?: number | bigint };

  const id = Number(result.lastInsertRowid);
  const created = getAuditLogById(db, id);
  if (!created) throw new Error("Audit log was not created");
  return created;
}

export function getAuditLogById(db: SamDb, id: number): AuditLogView | null {
  const row = db.prepare("SELECT * FROM audit_logs WHERE id = ?").get(id) as AuditLogRow | undefined;
  return row ? toAuditLogView(row) : null;
}

export function listAuditLogs(db: SamDb, options: { limit?: number } = {}): { items: AuditLogView[] } {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const rows = db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY id DESC
    LIMIT ?
  `).all(limit) as AuditLogRow[];

  return { items: rows.map(toAuditLogView) };
}
