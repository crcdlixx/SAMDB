import type { ImportJob } from "../api";

type ImportExecutionPanelProps = {
  summary: ImportJob["summary"];
  status: ImportJob["status"];
  blocked: boolean;
  confirmExecute: boolean;
  executing: boolean;
  onConfirmToggle: (value: boolean) => void;
  onExecute: () => void;
};

export function ImportExecutionPanel({
  summary,
  status,
  blocked,
  confirmExecute,
  executing,
  onConfirmToggle,
  onExecute
}: ImportExecutionPanelProps) {
  return (
    <section className="import-execution-panel work-card">
      <h3>执行导入</h3>
      <p className="muted">执行前将自动创建 SQLite 备份。任务状态：{status}</p>
      {summary ? (
        <ul>
          <li>创建：{summary.createCount}</li>
          <li>覆盖：{summary.overwriteCount}</li>
          <li>合并：{summary.mergeCount}</li>
          <li>跳过：{summary.skipCount}</li>
          <li>待处理：{summary.needsReviewCount}</li>
        </ul>
      ) : null}
      <p className="muted">即将创建备份文件</p>
      <label>
        <input
          type="checkbox"
          checked={confirmExecute}
          disabled={blocked || executing || status === "completed"}
          onChange={(event) => onConfirmToggle(event.target.checked)}
        />
        我已确认动作并了解将创建数据库备份
      </label>
      <button
        type="button"
        disabled={blocked || !confirmExecute || executing || status === "completed"}
        onClick={onExecute}
      >
        {executing ? "执行中…" : "执行导入"}
      </button>
      {blocked && status !== "completed" ? (
        <p className="notice error">存在待处理项或阻断错误，请先调整动作或跳过。</p>
      ) : null}
      {summary?.backupFile ? <p>备份：{summary.backupFile}</p> : null}
      {status === "completed" ? (
        <p>完成：成功 {summary?.successCount ?? 0}，失败 {summary?.failedCount ?? 0}</p>
      ) : null}
    </section>
  );
}
