import { useEffect, useState } from "react";
import {
  createAdminWorkRelation,
  deleteAdminWorkRelation,
  fetchAdminWorkRelations,
  updateAdminWorkRelation,
  type Work,
  type WorkRelation
} from "../api";

type RelationFormProps = {
  workId: string;
  works: Work[];
};

const relationTypes = [
  "same_series",
  "sequel",
  "prequel",
  "remake",
  "adaptation_of",
  "spin_off",
  "alternate_version",
  "fanwork_of",
  "references",
  "related"
];

export function RelationForm({ workId, works }: RelationFormProps) {
  const [relations, setRelations] = useState<WorkRelation[]>([]);
  const [targetWorkId, setTargetWorkId] = useState("");
  const [relationType, setRelationType] = useState("related");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function loadRelations() {
    const result = await fetchAdminWorkRelations(workId);
    setRelations(result.items);
  }

  useEffect(() => {
    loadRelations().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "加载关系失败"));
  }, [workId]);

  async function handleCreate() {
    if (!targetWorkId) return;
    await createAdminWorkRelation(workId, {
      targetWorkId,
      relationType,
      direction: relationType === "same_series" || relationType === "related" ? "bidirectional" : "directed",
      note,
      visibility: "public"
    });
    setNote("");
    await loadRelations();
  }

  async function handleHide(id: number) {
    await updateAdminWorkRelation(id, { visibility: "internal" });
    await loadRelations();
  }

  async function handleDelete(id: number) {
    await deleteAdminWorkRelation(id);
    await loadRelations();
  }

  function showError(error: unknown, fallback: string) {
    setMessage(error instanceof Error ? error.message : fallback);
  }

  return (
    <section className="work-card">
      <strong>作品关系</strong>
      {message ? <p>{message}</p> : null}
      {relations.length === 0 ? <p className="muted">暂无关联作品。</p> : null}
      {relations.map((relation) => (
        <article className="work-card" key={relation.id}>
          <strong>{relation.target_title}</strong>
          <div className="tag-row">
            <span className="tag">{relation.relation_type}</span>
            <span className="tag">{relation.direction}</span>
            {relation.visibility ? <span className="tag">{relation.visibility}</span> : null}
          </div>
          {relation.note ? <p>{relation.note}</p> : null}
          <div className="button-row">
            <button
              type="button"
              onClick={() => handleHide(relation.id).catch((error: unknown) => showError(error, "隐藏关系失败"))}
            >
              隐藏关系：{relation.target_title}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(relation.id).catch((error: unknown) => showError(error, "删除关系失败"))}
            >
              删除关系：{relation.target_title}
            </button>
          </div>
        </article>
      ))}
      <label>目标作品
        <select value={targetWorkId} onChange={(event) => setTargetWorkId(event.target.value)}>
          <option value="">选择作品</option>
          {works.filter((work) => work.id !== workId).map((work) => (
            <option value={work.id} key={work.id}>{work.title}</option>
          ))}
        </select>
      </label>
      <label>关系类型
        <select value={relationType} onChange={(event) => setRelationType(event.target.value)}>
          {relationTypes.map((type) => (
            <option value={type} key={type}>{type}</option>
          ))}
        </select>
      </label>
      <label>备注 <textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <button type="button" onClick={() => handleCreate().catch((error: unknown) => showError(error, "添加关系失败"))}>添加关系</button>
    </section>
  );
}
