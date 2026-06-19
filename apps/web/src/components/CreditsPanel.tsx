import { useEffect, useState } from "react";
import {
  createAdminContributor,
  createAdminCover,
  deleteAdminContributor,
  deleteAdminCover,
  fetchAdminContributors,
  fetchAdminCovers,
  updateAdminContributor,
  updateAdminCover,
  type Contributor,
  type ContributorPayload,
  type Cover,
  type CoverPayload
} from "../api";

type CreditsPanelProps = {
  workId: string;
};

export function CreditsPanel({ workId }: CreditsPanelProps) {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [covers, setCovers] = useState<Cover[]>([]);
  const [contributorPayload, setContributorPayload] = useState<ContributorPayload>({
    name: "",
    role: "",
    creditName: "",
    note: "",
    visibility: "public"
  });
  const [coverPayload, setCoverPayload] = useState<CoverPayload>({
    id: "",
    url: "",
    source: "local",
    isPrimary: false,
    processNote: "",
    visibility: "public"
  });
  const [message, setMessage] = useState("");

  async function loadCredits() {
    const [contributorResult, coverResult] = await Promise.all([
      fetchAdminContributors(workId),
      fetchAdminCovers(workId)
    ]);
    setContributors(contributorResult.items);
    setCovers(coverResult.items);
  }

  useEffect(() => {
    loadCredits().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "加载制作人员与封面失败"));
  }, [workId]);

  async function handleCreateContributor() {
    await createAdminContributor(workId, contributorPayload);
    setContributorPayload((current) => ({ ...current, name: "", role: "", creditName: "", note: "" }));
    await loadCredits();
  }

  async function handleUpdateContributor(id: number, payload: Partial<ContributorPayload>) {
    await updateAdminContributor(id, payload);
    await loadCredits();
  }

  async function handleDeleteContributor(id: number) {
    await deleteAdminContributor(id);
    await loadCredits();
  }

  async function handleCreateCover() {
    await createAdminCover(workId, coverPayload);
    setCoverPayload((current) => ({ ...current, id: "", url: "", processNote: "", isPrimary: false }));
    await loadCredits();
  }

  async function handleUpdateCover(id: string, payload: Partial<CoverPayload>) {
    await updateAdminCover(id, payload);
    await loadCredits();
  }

  async function handleDeleteCover(id: string) {
    await deleteAdminCover(id);
    await loadCredits();
  }

  function showError(error: unknown, fallback: string) {
    setMessage(error instanceof Error ? error.message : fallback);
  }

  return (
    <section className="work-card">
      <strong>制作人员与封面</strong>
      {message ? <p>{message}</p> : null}

      <section className="inline-section">
        <strong>制作人员</strong>
        {contributors.length === 0 ? <p className="muted">暂无制作人员。</p> : null}
        {contributors.map((contributor) => (
          <article className="audit-row" key={contributor.id}>
            <div className="tag-row">
              <span className="tag">{contributor.role}</span>
              <span className="tag">{contributor.visibility}</span>
            </div>
            <strong>{contributor.name}</strong>
            {contributor.creditName ? <span className="muted">署名：{contributor.creditName}</span> : null}
            {contributor.note ? <p>{contributor.note}</p> : null}
            <div className="button-row">
              <button
                type="button"
                onClick={() => handleUpdateContributor(contributor.id, { visibility: "internal" }).catch((error: unknown) => showError(error, "设置制作人员可见性失败"))}
              >
                设为内部：{contributor.name}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteContributor(contributor.id).catch((error: unknown) => showError(error, "删除制作人员失败"))}
              >
                删除制作人员：{contributor.name}
              </button>
            </div>
          </article>
        ))}
        <label>署名 <input value={contributorPayload.name} onChange={(event) => setContributorPayload({ ...contributorPayload, name: event.target.value })} /></label>
        <label>角色 <input value={contributorPayload.role} onChange={(event) => setContributorPayload({ ...contributorPayload, role: event.target.value })} /></label>
        <label>显示署名 <input value={contributorPayload.creditName ?? ""} onChange={(event) => setContributorPayload({ ...contributorPayload, creditName: event.target.value })} /></label>
        <label>可见性
          <select value={contributorPayload.visibility} onChange={(event) => setContributorPayload({ ...contributorPayload, visibility: event.target.value })}>
            <option value="public">public</option>
            <option value="restricted">restricted</option>
            <option value="internal">internal</option>
          </select>
        </label>
        <label>备注 <textarea value={contributorPayload.note ?? ""} onChange={(event) => setContributorPayload({ ...contributorPayload, note: event.target.value })} /></label>
        <button type="button" onClick={() => handleCreateContributor().catch((error: unknown) => showError(error, "添加制作人员失败"))}>添加制作人员</button>
      </section>

      <section className="inline-section">
        <strong>封面</strong>
        {covers.length === 0 ? <p className="muted">暂无封面。</p> : null}
        {covers.map((cover) => (
          <article className="audit-row" key={cover.id}>
            <div className="tag-row">
              {cover.isPrimary ? <span className="tag">primary</span> : null}
              <span className="tag">{cover.visibility}</span>
              {cover.source ? <span className="tag">{cover.source}</span> : null}
            </div>
            <strong>{cover.id}</strong>
            <a href={cover.url} target="_blank" rel="noreferrer">{cover.url}</a>
            {cover.processNote ? <p>{cover.processNote}</p> : null}
            <div className="button-row">
              <button
                type="button"
                onClick={() => handleUpdateCover(cover.id, { isPrimary: true }).catch((error: unknown) => showError(error, "设置主封面失败"))}
              >
                设为主封面：{cover.id}
              </button>
              <button
                type="button"
                onClick={() => handleUpdateCover(cover.id, { visibility: "internal" }).catch((error: unknown) => showError(error, "设置封面可见性失败"))}
              >
                设为内部：{cover.id}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCover(cover.id).catch((error: unknown) => showError(error, "删除封面失败"))}
              >
                删除封面：{cover.id}
              </button>
            </div>
          </article>
        ))}
        <label>封面 ID <input value={coverPayload.id} onChange={(event) => setCoverPayload({ ...coverPayload, id: event.target.value })} /></label>
        <label>封面 URL <input value={coverPayload.url} onChange={(event) => setCoverPayload({ ...coverPayload, url: event.target.value })} /></label>
        <label>来源 <input value={coverPayload.source ?? ""} onChange={(event) => setCoverPayload({ ...coverPayload, source: event.target.value })} /></label>
        <label><input type="checkbox" checked={Boolean(coverPayload.isPrimary)} onChange={(event) => setCoverPayload({ ...coverPayload, isPrimary: event.target.checked })} /> 设为主封面</label>
        <label>可见性
          <select value={coverPayload.visibility} onChange={(event) => setCoverPayload({ ...coverPayload, visibility: event.target.value })}>
            <option value="public">public</option>
            <option value="restricted">restricted</option>
            <option value="internal">internal</option>
          </select>
        </label>
        <label>处理说明 <textarea value={coverPayload.processNote ?? ""} onChange={(event) => setCoverPayload({ ...coverPayload, processNote: event.target.value })} /></label>
        <button type="button" onClick={() => handleCreateCover().catch((error: unknown) => showError(error, "添加封面失败"))}>添加封面</button>
      </section>
    </section>
  );
}
