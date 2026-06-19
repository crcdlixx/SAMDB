import { useEffect, useState } from "react";
import {
  createAdminExternalLink,
  createAdminSource,
  deleteAdminExternalLink,
  deleteAdminSource,
  fetchAdminExternalLinks,
  fetchAdminSources,
  updateAdminExternalLink,
  updateAdminSource,
  type ExternalLink,
  type ExternalLinkPayload,
  type Source,
  type SourcePayload
} from "../api";

type EvidencePanelProps = {
  workId: string;
};

export function EvidencePanel({ workId }: EvidencePanelProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [externalLinks, setExternalLinks] = useState<ExternalLink[]>([]);
  const [sourcePayload, setSourcePayload] = useState<SourcePayload>({
    sourceType: "official",
    title: "",
    url: "",
    evidenceLevel: "primary",
    note: "",
    visibility: "public"
  });
  const [linkPayload, setLinkPayload] = useState<ExternalLinkPayload>({
    targetType: "official_site",
    title: "",
    url: "",
    relationType: "homepage",
    note: "",
    visibility: "public"
  });
  const [message, setMessage] = useState("");

  async function loadEvidence() {
    const [sourceResult, linkResult] = await Promise.all([
      fetchAdminSources(workId),
      fetchAdminExternalLinks(workId)
    ]);
    setSources(sourceResult.items);
    setExternalLinks(linkResult.items);
  }

  useEffect(() => {
    loadEvidence().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "加载来源与外链失败"));
  }, [workId]);

  async function handleCreateSource() {
    await createAdminSource(workId, sourcePayload);
    setSourcePayload((current) => ({ ...current, title: "", url: "", note: "" }));
    await loadEvidence();
  }

  async function handleHideSource(id: number) {
    await updateAdminSource(id, { visibility: "internal" });
    await loadEvidence();
  }

  async function handleDeleteSource(id: number) {
    await deleteAdminSource(id);
    await loadEvidence();
  }

  async function handleCreateExternalLink() {
    await createAdminExternalLink(workId, linkPayload);
    setLinkPayload((current) => ({ ...current, title: "", url: "", note: "" }));
    await loadEvidence();
  }

  async function handleHideExternalLink(id: number) {
    await updateAdminExternalLink(id, { visibility: "internal" });
    await loadEvidence();
  }

  async function handleDeleteExternalLink(id: number) {
    await deleteAdminExternalLink(id);
    await loadEvidence();
  }

  function showError(error: unknown, fallback: string) {
    setMessage(error instanceof Error ? error.message : fallback);
  }

  return (
    <section className="work-card">
      <strong>来源与外链</strong>
      {message ? <p>{message}</p> : null}

      <section className="inline-section">
        <strong>来源记录</strong>
        {sources.length === 0 ? <p className="muted">暂无来源记录。</p> : null}
        {sources.map((source) => {
          const label = source.title ?? source.url ?? `来源 #${source.id}`;
          return (
            <article className="audit-row" key={source.id}>
              <div className="tag-row">
                {source.sourceType ? <span className="tag">{source.sourceType}</span> : null}
                {source.evidenceLevel ? <span className="tag">{source.evidenceLevel}</span> : null}
                <span className="tag">{source.visibility}</span>
              </div>
              <strong>{label}</strong>
              {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.url}</a> : null}
              {source.note ? <p>{source.note}</p> : null}
              <div className="button-row">
                <button
                  type="button"
                  onClick={() => handleHideSource(source.id).catch((error: unknown) => showError(error, "隐藏来源失败"))}
                >
                  隐藏来源：{label}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSource(source.id).catch((error: unknown) => showError(error, "删除来源失败"))}
                >
                  删除来源：{label}
                </button>
              </div>
            </article>
          );
        })}
        <label>来源标题 <input value={sourcePayload.title ?? ""} onChange={(event) => setSourcePayload({ ...sourcePayload, title: event.target.value })} /></label>
        <label>来源 URL <input value={sourcePayload.url ?? ""} onChange={(event) => setSourcePayload({ ...sourcePayload, url: event.target.value })} /></label>
        <label>来源类型 <input value={sourcePayload.sourceType ?? ""} onChange={(event) => setSourcePayload({ ...sourcePayload, sourceType: event.target.value })} /></label>
        <label>证据级别 <input value={sourcePayload.evidenceLevel ?? ""} onChange={(event) => setSourcePayload({ ...sourcePayload, evidenceLevel: event.target.value })} /></label>
        <label>可见性
          <select value={sourcePayload.visibility} onChange={(event) => setSourcePayload({ ...sourcePayload, visibility: event.target.value })}>
            <option value="public">public</option>
            <option value="restricted">restricted</option>
            <option value="internal">internal</option>
          </select>
        </label>
        <label>备注 <textarea value={sourcePayload.note ?? ""} onChange={(event) => setSourcePayload({ ...sourcePayload, note: event.target.value })} /></label>
        <button type="button" onClick={() => handleCreateSource().catch((error: unknown) => showError(error, "添加来源失败"))}>添加来源</button>
      </section>

      <section className="inline-section">
        <strong>外部链接</strong>
        {externalLinks.length === 0 ? <p className="muted">暂无外部链接。</p> : null}
        {externalLinks.map((link) => {
          const label = link.title ?? link.url ?? `外链 #${link.id}`;
          return (
            <article className="audit-row" key={link.id}>
              <div className="tag-row">
                <span className="tag">{link.targetType}</span>
                {link.relationType ? <span className="tag">{link.relationType}</span> : null}
                <span className="tag">{link.visibility}</span>
              </div>
              <strong>{label}</strong>
              {link.url ? <a href={link.url} target="_blank" rel="noreferrer">{link.url}</a> : null}
              {link.note ? <p>{link.note}</p> : null}
              <div className="button-row">
                <button
                  type="button"
                  onClick={() => handleHideExternalLink(link.id).catch((error: unknown) => showError(error, "隐藏外链失败"))}
                >
                  隐藏外链：{label}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteExternalLink(link.id).catch((error: unknown) => showError(error, "删除外链失败"))}
                >
                  删除外链：{label}
                </button>
              </div>
            </article>
          );
        })}
        <label>外链标题 <input value={linkPayload.title ?? ""} onChange={(event) => setLinkPayload({ ...linkPayload, title: event.target.value })} /></label>
        <label>外链 URL <input value={linkPayload.url ?? ""} onChange={(event) => setLinkPayload({ ...linkPayload, url: event.target.value })} /></label>
        <label>目标类型 <input value={linkPayload.targetType} onChange={(event) => setLinkPayload({ ...linkPayload, targetType: event.target.value })} /></label>
        <label>关系说明 <input value={linkPayload.relationType ?? ""} onChange={(event) => setLinkPayload({ ...linkPayload, relationType: event.target.value })} /></label>
        <label>可见性
          <select value={linkPayload.visibility} onChange={(event) => setLinkPayload({ ...linkPayload, visibility: event.target.value })}>
            <option value="public">public</option>
            <option value="restricted">restricted</option>
            <option value="internal">internal</option>
          </select>
        </label>
        <label>备注 <textarea value={linkPayload.note ?? ""} onChange={(event) => setLinkPayload({ ...linkPayload, note: event.target.value })} /></label>
        <button type="button" onClick={() => handleCreateExternalLink().catch((error: unknown) => showError(error, "添加外链失败"))}>添加外链</button>
      </section>
    </section>
  );
}
