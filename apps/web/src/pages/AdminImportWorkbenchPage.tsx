import { useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../api";
import {
  executeImportJob,
  fetchAdminBackups,
  fetchAdminImportJob,
  fetchAdminImportJobs,
  previewImportJob,
  updateImportCandidate,
  type BackupSnapshot,
  type ImportCandidate,
  type ImportJob
} from "../api";
import { ImportExecutionPanel } from "../components/ImportExecutionPanel";
import { ImportPreviewTable } from "../components/ImportPreviewTable";
import { ImportCandidateDetail } from "../components/ImportCandidateDetail";
import { ImportSourceEditor } from "../components/ImportSourceEditor";

type AdminImportWorkbenchPageProps = {
  user: AuthUser;
};

export function AdminImportWorkbenchPage({ user }: AdminImportWorkbenchPageProps) {
  const canExecute = user.role === "owner" || user.role === "editor";
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [message, setMessage] = useState("");
  const [confirmExecute, setConfirmExecute] = useState(false);
  const [executing, setExecuting] = useState(false);

  async function loadJobs() {
    const result = await fetchAdminImportJobs();
    setJobs(result.items);
  }

  async function loadJob(jobId: string) {
    const job = await fetchAdminImportJob(jobId);
    setSelectedJob(job);
    const candidates = job.candidates ?? [];
    if (!selectedCandidateId || !candidates.some((c) => c.id === selectedCandidateId)) {
      setSelectedCandidateId(candidates[0]?.id ?? null);
    }
  }

  async function loadBackups() {
    const result = await fetchAdminBackups();
    setBackups(result.items);
  }

  useEffect(() => {
    loadJobs().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "加载任务失败"));
    loadBackups().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJob(null);
      setSelectedCandidateId(null);
      return;
    }
    loadJob(selectedJobId).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "加载任务详情失败"));
  }, [selectedJobId]);

  const selectedCandidate = useMemo(
    () => selectedJob?.candidates?.find((c) => c.id === selectedCandidateId) ?? null,
    [selectedJob, selectedCandidateId]
  );

  const executionBlocked = useMemo(() => {
    if (!selectedJob) return true;
    const candidates = selectedJob.candidates ?? [];
    if (selectedJob.status === "completed" || selectedJob.status === "executing") return true;
    const hasNeedsReview = candidates.some((c) => c.action === "needs_review");
    const hasBlockingErrors = candidates.some(
      (c) => c.action !== "skip" && c.issues.some((i) => i.severity === "error")
    );
    const hasExecutable = candidates.some((c) => c.action !== "needs_review" && c.action !== "skip");
    return hasNeedsReview || hasBlockingErrors || !hasExecutable;
  }, [selectedJob]);

  async function handlePreview(markdown: string) {
    const job = await previewImportJob({ sourceType: "markdown", markdown });
    await loadJobs();
    setSelectedJobId(job.id);
    setSelectedJob(job);
    setSelectedCandidateId(job.candidates?.[0]?.id ?? null);
    setMessage(`已创建预览任务，共 ${job.candidates?.length ?? 0} 条候选项`);
  }

  async function handleUpdateCandidate(candidateId: string, patch: { action?: ImportCandidate["action"]; targetWorkId?: string | null }) {
    if (!selectedJobId) return;
    await updateImportCandidate(candidateId, patch);
    await loadJob(selectedJobId);
  }

  async function handleExecute() {
    if (!selectedJobId || !canExecute) return;
    setExecuting(true);
    try {
      const job = await executeImportJob(selectedJobId);
      setSelectedJob(job);
      await loadJobs();
      await loadBackups();
      setConfirmExecute(false);
      setMessage(`导入完成：成功 ${job.summary?.successCount ?? 0}，跳过 ${job.summary?.skipCount ?? 0}，失败 ${job.summary?.failedCount ?? 0}`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "执行导入失败");
    } finally {
      setExecuting(false);
    }
  }

  return (
    <section className="import-workbench">
      <header className="section-heading">
        <div>
          <p className="eyebrow">导入治理</p>
          <h2>批量导入工作台</h2>
        </div>
      </header>

      {message ? <p className="notice">{message}</p> : null}

      <ImportSourceEditor onPreview={handlePreview} disabled={!canExecute} />

      <div className="import-workbench-grid">
        <aside className="import-job-list">
          <h3>导入任务</h3>
          {jobs.length === 0 ? <p className="muted">暂无任务</p> : null}
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              className={`list-row ${selectedJobId === job.id ? "active" : ""}`}
              onClick={() => setSelectedJobId(job.id)}
            >
              <strong>{job.status}</strong>
              <span className="muted">{new Date(job.createdAt).toLocaleString()}</span>
              <span>{job.summary?.totalCandidates ?? 0} 候选 · {job.summary?.errorCount ?? 0} 错误 · {job.summary?.matchCount ?? 0} 重复</span>
            </button>
          ))}
        </aside>

        <div className="import-main">
          {!selectedJob ? (
            <p className="muted">创建或选择一个导入任务以查看候选项。</p>
          ) : (
            <>
              <ImportPreviewTable
                candidates={selectedJob.candidates ?? []}
                selectedId={selectedCandidateId}
                onSelect={setSelectedCandidateId}
              />
              <ImportExecutionPanel
                summary={selectedJob.summary}
                status={selectedJob.status}
                blocked={executionBlocked || !canExecute}
                confirmExecute={confirmExecute}
                executing={executing}
                onConfirmToggle={setConfirmExecute}
                onExecute={() => void handleExecute()}
              />
            </>
          )}
        </div>

        <aside className="import-detail-panel">
          <ImportCandidateDetail
            candidate={selectedCandidate}
            canEdit={canExecute && selectedJob?.status !== "completed"}
            onUpdate={(patch) => selectedCandidate ? handleUpdateCandidate(selectedCandidate.id, patch) : undefined}
          />
        </aside>
      </div>

      <section className="inline-section">
        <h3>备份快照</h3>
        <p className="muted">恢复需手动停止服务后替换数据库文件。完整路径仅 owner 可见。</p>
        {backups.length === 0 ? <p className="muted">暂无备份</p> : null}
        <div className="timeline">
          {backups.map((backup) => (
            <article className="timeline-item" key={backup.id}>
              <strong>{backup.reason}</strong>
              <span className="muted">{new Date(backup.createdAt).toLocaleString()}</span>
              <code>{backup.filePath}</code>
              {backup.sizeBytes != null ? <span className="muted">{(backup.sizeBytes / 1024).toFixed(1)} KB</span> : null}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
