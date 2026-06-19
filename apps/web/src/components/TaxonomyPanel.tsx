import { useEffect, useState } from "react";
import {
  attachAdminTaxonomyTerm,
  createAdminTaxonomy,
  createAdminTaxonomyTerm,
  detachAdminTaxonomyTerm,
  fetchAdminTaxonomies,
  fetchAdminTaxonomyTerms,
  fetchAdminWorkTaxonomyTerms,
  type Taxonomy,
  type TaxonomyTerm,
  type WorkTaxonomyTerm
} from "../api";

type TaxonomyPanelProps = {
  workId: string;
};

export function TaxonomyPanel({ workId }: TaxonomyPanelProps) {
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([]);
  const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
  const [attachedTerms, setAttachedTerms] = useState<WorkTaxonomyTerm[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [selectedTermId, setSelectedTermId] = useState("");
  const [message, setMessage] = useState("");
  const [newTaxonomy, setNewTaxonomy] = useState({ id: "", code: "", name: "" });
  const [newTerm, setNewTerm] = useState({ id: "", label: "", slug: "" });

  async function loadTaxonomies() {
    const result = await fetchAdminTaxonomies();
    setTaxonomies(result.items);
    if (!selectedCode && result.items[0]) setSelectedCode(result.items[0].code);
  }

  async function loadAttachedTerms() {
    const result = await fetchAdminWorkTaxonomyTerms(workId);
    setAttachedTerms(result.items);
  }

  useEffect(() => {
    loadTaxonomies().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "加载分类失败"));
    loadAttachedTerms().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "加载挂载失败"));
  }, [workId]);

  useEffect(() => {
    if (!selectedCode) {
      setTerms([]);
      return;
    }
    fetchAdminTaxonomyTerms(selectedCode).then((result) => {
      setTerms(result.items);
      setSelectedTermId(result.items[0]?.id ?? "");
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "加载分类项失败"));
  }, [selectedCode]);

  async function handleCreateTaxonomy() {
    await createAdminTaxonomy(newTaxonomy);
    setNewTaxonomy({ id: "", code: "", name: "" });
    await loadTaxonomies();
  }

  async function handleCreateTerm() {
    const taxonomy = taxonomies.find((item) => item.code === selectedCode);
    if (!taxonomy) return;
    await createAdminTaxonomyTerm(selectedCode, {
      ...newTerm,
      taxonomyId: taxonomy.id
    });
    setNewTerm({ id: "", label: "", slug: "" });
    const result = await fetchAdminTaxonomyTerms(selectedCode);
    setTerms(result.items);
  }

  async function handleAttach() {
    if (!selectedTermId) return;
    await attachAdminTaxonomyTerm(workId, {
      termId: selectedTermId,
      relationType: selectedCode || "tag"
    });
    await loadAttachedTerms();
  }

  async function handleDetach(attachmentId: number) {
    await detachAdminTaxonomyTerm(attachmentId);
    await loadAttachedTerms();
  }

  function showError(error: unknown, fallback: string) {
    setMessage(error instanceof Error ? error.message : fallback);
  }

  return (
    <section className="work-card">
      <strong>分类挂载</strong>
      {message ? <p>{message}</p> : null}
      <div className="tag-row">
        {attachedTerms.map((term) => {
          const label = `${term.taxonomy_code}: ${term.label}`;
          return (
            <button
              className="tag"
              key={term.id}
              type="button"
              onClick={() => handleDetach(term.id).catch((error: unknown) => showError(error, "移除分类失败"))}
            >
              移除分类：{label}
            </button>
          );
        })}
      </div>

      <label>分类体系
        <select value={selectedCode} onChange={(event) => setSelectedCode(event.target.value)}>
          {taxonomies.map((taxonomy) => (
            <option value={taxonomy.code} key={taxonomy.id}>{taxonomy.name}</option>
          ))}
        </select>
      </label>
      <label>分类项
        <select value={selectedTermId} onChange={(event) => setSelectedTermId(event.target.value)}>
          {terms.map((term) => (
            <option value={term.id} key={term.id}>{term.label}</option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => handleAttach().catch((error: unknown) => showError(error, "挂载分类项失败"))}>挂载分类项</button>

      <details>
        <summary>新建分类体系</summary>
        <label>ID <input value={newTaxonomy.id} onChange={(event) => setNewTaxonomy({ ...newTaxonomy, id: event.target.value })} /></label>
        <label>代码 <input value={newTaxonomy.code} onChange={(event) => setNewTaxonomy({ ...newTaxonomy, code: event.target.value })} /></label>
        <label>名称 <input value={newTaxonomy.name} onChange={(event) => setNewTaxonomy({ ...newTaxonomy, name: event.target.value })} /></label>
        <button type="button" onClick={() => handleCreateTaxonomy().catch((error: unknown) => showError(error, "新建分类体系失败"))}>新建分类体系</button>
      </details>

      <details>
        <summary>新建分类项</summary>
        <label>ID <input value={newTerm.id} onChange={(event) => setNewTerm({ ...newTerm, id: event.target.value })} /></label>
        <label>名称 <input value={newTerm.label} onChange={(event) => setNewTerm({ ...newTerm, label: event.target.value })} /></label>
        <label>Slug <input value={newTerm.slug} onChange={(event) => setNewTerm({ ...newTerm, slug: event.target.value })} /></label>
        <button type="button" onClick={() => handleCreateTerm().catch((error: unknown) => showError(error, "新建分类项失败"))}>新建分类项</button>
      </details>
    </section>
  );
}
