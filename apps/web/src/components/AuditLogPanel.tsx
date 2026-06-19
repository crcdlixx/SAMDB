import { useEffect, useState } from "react";
import { fetchAdminAuditLogs, type AuditLog } from "../api";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function titleFrom(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("title" in value)) return null;
  const title = (value as { title?: unknown }).title;
  return title ? String(title) : null;
}

function describeChange(log: AuditLog): string | null {
  const beforeTitle = titleFrom(log.before);
  const afterTitle = titleFrom(log.after);
  if (beforeTitle && afterTitle && beforeTitle !== afterTitle) {
    return `${beforeTitle} -> ${afterTitle}`;
  }
  if (afterTitle) return afterTitle;
  return null;
}

export function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [message, setMessage] = useState("");

  async function loadLogs() {
    const result = await fetchAdminAuditLogs();
    setLogs(result.items);
  }

  useEffect(() => {
    loadLogs().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "加载操作记录失败"));
  }, []);

  return (
    <section className="work-card">
      <div className="toolbar compact-toolbar">
        <strong>最近操作</strong>
        <button type="button" onClick={() => loadLogs().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "加载操作记录失败"))}>刷新</button>
      </div>
      {message ? <p>{message}</p> : null}
      {logs.length === 0 ? <p className="muted">暂无操作记录。</p> : null}
      {logs.map((log) => (
        <article className="audit-row" key={log.id}>
          <div className="tag-row">
            <span className="tag">{log.action}</span>
            <span className="tag">{log.entityType}: {log.entityId}</span>
          </div>
          {describeChange(log) ? <span>{describeChange(log)}</span> : null}
          <span className="muted">{formatDate(log.createdAt)}</span>
        </article>
      ))}
    </section>
  );
}
