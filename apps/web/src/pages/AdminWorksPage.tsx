import { useEffect, useState } from "react";
import {
  createAdminAccessEntry,
  createAdminRelease,
  createAdminWork,
  deleteAdminAccessEntry,
  deleteAdminRelease,
  deleteAdminWork,
  exportAdminWorks,
  fetchAdminAccessEntries,
  fetchAdminReleases,
  fetchAdminWork,
  fetchAdminWorks,
  updateAdminAccessEntry,
  updateAdminRelease,
  updateAdminWork,
  type AccessEntry,
  type AccessEntryPayload,
  type Release,
  type ReleasePayload,
  type Work,
  type WorkPayload
} from "../api";
import { AccessEntryForm } from "../components/AccessEntryForm";
import { AuditLogPanel } from "../components/AuditLogPanel";
import { CreditsPanel } from "../components/CreditsPanel";
import { EvidencePanel } from "../components/EvidencePanel";
import { ImportPanel } from "../components/ImportPanel";
import { RelationForm } from "../components/RelationForm";
import { ReleaseForm } from "../components/ReleaseForm";
import { TaxonomyPanel } from "../components/TaxonomyPanel";
import { WorkForm } from "../components/WorkForm";

export function AdminWorksPage({ onOpenImportGovernance }: { onOpenImportGovernance?: () => void } = {}) {
  const [works, setWorks] = useState<Work[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [selectedWork, setSelectedWork] = useState<Work | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [accessByRelease, setAccessByRelease] = useState<Record<string, AccessEntry[]>>({});
  const [message, setMessage] = useState("");

  async function loadWorks() {
    const result = await fetchAdminWorks();
    setWorks(result.items);
  }

  async function loadSelectedWork(workId: string) {
    const work = await fetchAdminWork(workId);
    setSelectedWork(work);
  }

  async function loadReleases(workId: string) {
    const result = await fetchAdminReleases(workId);
    setReleases(result.items);
    const accessPairs = await Promise.all(result.items.map(async (release) => {
      const access = await fetchAdminAccessEntries(release.releaseId);
      return [release.releaseId, access.items] as const;
    }));
    setAccessByRelease(Object.fromEntries(accessPairs));
  }

  useEffect(() => {
    loadWorks().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "加载作品失败"));
  }, []);

  useEffect(() => {
    if (!selectedWorkId) {
      setSelectedWork(null);
      setReleases([]);
      setAccessByRelease({});
      return;
    }
    Promise.all([
      loadSelectedWork(selectedWorkId),
      loadReleases(selectedWorkId)
    ]).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "加载作品详情失败"));
  }, [selectedWorkId]);

  async function refreshSelected() {
    if (!selectedWorkId) return;
    await Promise.all([
      loadSelectedWork(selectedWorkId),
      loadReleases(selectedWorkId)
    ]);
  }

  async function handleCreate(payload: WorkPayload) {
    const work = await createAdminWork(payload);
    await loadWorks();
    setSelectedWorkId(work.id);
  }

  async function handleUpdate(payload: WorkPayload) {
    if (!selectedWorkId) return;
    const work = await updateAdminWork(selectedWorkId, payload);
    setSelectedWork(work);
    await loadWorks();
    setMessage(`已更新作品：${work.title}`);
  }

  async function handleDeleteWork() {
    if (!selectedWorkId) return;
    const id = selectedWorkId;
    await deleteAdminWork(id);
    setSelectedWorkId(null);
    setSelectedWork(null);
    setReleases([]);
    setAccessByRelease({});
    await loadWorks();
    setMessage(`已删除作品：${id}`);
  }

  async function handleCreateRelease(payload: ReleasePayload) {
    if (!selectedWorkId) return;
    await createAdminRelease(selectedWorkId, payload);
    await loadReleases(selectedWorkId);
  }

  async function handleHideRelease(releaseId: string) {
    await updateAdminRelease(releaseId, { releaseStatus: "offline" });
    await refreshSelected();
  }

  async function handleDeleteRelease(releaseId: string) {
    await deleteAdminRelease(releaseId);
    await refreshSelected();
  }

  async function handleCreateAccess(releaseId: string, payload: AccessEntryPayload) {
    await createAdminAccessEntry(releaseId, payload);
    await refreshSelected();
  }

  async function handleHideAccess(accessId: string) {
    await updateAdminAccessEntry(accessId, { visibility: "internal" });
    await refreshSelected();
  }

  async function handleDeleteAccess(accessId: string) {
    await deleteAdminAccessEntry(accessId);
    await refreshSelected();
  }

  async function handleExport() {
    const result = await exportAdminWorks();
    setMessage(`已导出 ${result.files.length} 个文件`);
  }

  function showError(error: unknown, fallback: string) {
    setMessage(error instanceof Error ? error.message : fallback);
  }

  return (
    <section className="admin-layout">
      <div>
        <div className="toolbar">
          <button onClick={handleExport}>导出作品</button>
        </div>
        {message ? <p>{message}</p> : null}
        <AuditLogPanel />
        <ImportPanel onOpenWorkbench={onOpenImportGovernance} />
        <h1>新建作品</h1>
        <WorkForm submitLabel="创建作品" onSubmit={handleCreate} />
        <h2>作品列表</h2>
        <div className="work-grid">
          {works.map((work) => (
            <article className="work-card" key={work.id} onClick={() => setSelectedWorkId(work.id)}>
              <strong>{work.title}</strong>
              <span className="muted">{work.id}</span>
              <div className="tag-row">
                <span className="tag">{work.recordStatus}</span>
                <span className="tag">{work.visibility}</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div>
        <h2>编辑作品与维护版本</h2>
        {!selectedWorkId ? <p className="muted">选择一个作品后维护元数据、制作人员、封面、版本、获取方式、分类与关联。</p> : null}
        {selectedWorkId && selectedWork ? (
          <>
            <p className="muted">当前作品：{selectedWorkId}</p>
            <h3>基础元数据</h3>
            <WorkForm initial={selectedWork} submitLabel="保存修改" onSubmit={handleUpdate} />
            <div className="button-row">
              <button
                type="button"
                onClick={() => handleDeleteWork().catch((error: unknown) => showError(error, "删除作品失败"))}
              >
                删除作品：{selectedWorkId}
              </button>
            </div>
            <CreditsPanel workId={selectedWorkId} />
            <EvidencePanel workId={selectedWorkId} />
            <TaxonomyPanel workId={selectedWorkId} />
            <RelationForm workId={selectedWorkId} works={works} />
            <ReleaseForm onSubmit={handleCreateRelease} />
            <h3>版本</h3>
            {releases.length === 0 ? <p className="muted">暂无版本。</p> : null}
            {releases.map((release) => (
              <section className="work-card" key={release.releaseId}>
                <strong>{release.releaseTitle ?? release.releaseId}</strong>
                <div className="tag-row">
                  <span className="tag">{release.releaseStatus}</span>
                  {release.releaseDate ? <span className="tag">{release.releaseDate}</span> : null}
                  {release.resolution ? <span className="tag">{release.resolution}</span> : null}
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    onClick={() => handleHideRelease(release.releaseId).catch((error: unknown) => showError(error, "隐藏版本失败"))}
                  >
                    隐藏版本：{release.releaseId}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRelease(release.releaseId).catch((error: unknown) => showError(error, "删除版本失败"))}
                  >
                    删除版本：{release.releaseId}
                  </button>
                </div>
                <h4>获取方式</h4>
                {(accessByRelease[release.releaseId] ?? []).map((entry) => (
                  <article className="work-card" key={entry.accessId}>
                    <strong>{entry.platform ?? entry.accessType}</strong>
                    <span className="muted">{entry.url}</span>
                    <div className="tag-row">
                      <span className="tag">{entry.visibility}</span>
                      {entry.availability ? <span className="tag">{entry.availability}</span> : null}
                    </div>
                    <div className="button-row">
                      <button
                        type="button"
                        onClick={() => entry.accessId ? handleHideAccess(entry.accessId).catch((error: unknown) => showError(error, "隐藏获取方式失败")) : undefined}
                      >
                        隐藏获取方式：{entry.accessId}
                      </button>
                      <button
                        type="button"
                        onClick={() => entry.accessId ? handleDeleteAccess(entry.accessId).catch((error: unknown) => showError(error, "删除获取方式失败")) : undefined}
                      >
                        删除获取方式：{entry.accessId}
                      </button>
                    </div>
                  </article>
                ))}
                <AccessEntryForm releaseId={release.releaseId} onSubmit={handleCreateAccess} />
              </section>
            ))}
          </>
        ) : null}
      </div>
    </section>
  );
}
