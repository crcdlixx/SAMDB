import { useEffect, useMemo, useState } from "react";
import {
  fetchPublicRelationNetwork,
  fetchWork,
  fetchWorkRelations,
  fetchWorkTaxonomyTerms,
  type RelationNetworkGroup,
  type WorkDetail,
  type WorkTaxonomyTerm
} from "../api";
import { displayWorkText } from "../i18n";

type WorkDetailPageProps = {
  id: string;
  onBack: () => void;
};

export function WorkDetailPage({ id, onBack }: WorkDetailPageProps) {
  const [work, setWork] = useState<WorkDetail | null>(null);
  const [taxonomyTerms, setTaxonomyTerms] = useState<WorkTaxonomyTerm[]>([]);
  const [relationGroups, setRelationGroups] = useState<RelationNetworkGroup[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchWork(id),
      fetchWorkTaxonomyTerms(id),
      fetchPublicRelationNetwork(id).catch(async () => {
        const fallback = await fetchWorkRelations(id);
        return {
          groups: fallback.items.length === 0 ? [] : [{
            group: "related",
            label: "关联作品",
            items: fallback.items.map((item) => ({
              relationId: item.id,
              workId: item.target_work_id,
              title: item.target_title,
              year: null,
              relationType: item.relation_type,
              group: "related",
              label: item.relation_type,
              reverse: false,
              note: item.note
            }))
          }]
        };
      })
    ]).then(([workResult, termResult, relationResult]) => {
      setWork(workResult);
      setTaxonomyTerms(termResult.items);
      setRelationGroups(relationResult.groups);
      setError(null);
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "加载失败");
    });
  }, [id]);

  const primaryCover = useMemo(() => work?.covers?.find((cover) => cover.isPrimary) ?? work?.covers?.[0] ?? null, [work]);

  if (error) return <p>{error}</p>;
  if (!work) return <p>加载中...</p>;
  const text = displayWorkText(work);

  return (
    <article>
      <button onClick={onBack}>返回</button>
      {primaryCover ? <img src={primaryCover.url} alt={text.title} className="detail-cover" /> : null}
      <h1>{text.title}</h1>
      {work.titleOriginal ? <p className="muted">{work.titleOriginal}</p> : null}
      <p>{text.summaryShort}</p>
      {text.summaryFull ? <p>{text.summaryFull}</p> : null}

      <div className="tag-row">
        {taxonomyTerms.map((term) => (
          <span className="tag" key={term.id}>{term.taxonomy_code}: {term.label}</span>
        ))}
        {work.tags.map((tag) => (
          <span className="tag" key={tag}>{tag}</span>
        ))}
      </div>

      {work.contributors && work.contributors.length > 0 ? (
        <>
          <h2>制作人员</h2>
          {work.contributors.map((contributor) => (
            <article className="work-card" key={contributor.id}>
              <strong>{contributor.creditName ?? contributor.name}</strong>
              <div className="tag-row">
                <span className="tag">{contributor.role}</span>
              </div>
              {contributor.creditName && contributor.creditName !== contributor.name ? <p className="muted">本名：{contributor.name}</p> : null}
              {contributor.note ? <p>{contributor.note}</p> : null}
            </article>
          ))}
        </>
      ) : null}

      {work.covers && work.covers.length > 0 ? (
        <>
          <h2>封面</h2>
          <div className="cover-grid">
            {work.covers.map((cover) => (
              <article className="work-card" key={cover.id}>
                <img src={cover.url} alt={cover.id} className="cover-thumb" />
                <div className="tag-row">
                  {cover.isPrimary ? <span className="tag">primary</span> : null}
                  {cover.source ? <span className="tag">{cover.source}</span> : null}
                </div>
                {cover.processNote ? <p>{cover.processNote}</p> : null}
              </article>
            ))}
          </div>
        </>
      ) : null}

      <h2>来源</h2>
      <p>{work.sourcePrimary}</p>
      {work.sources && work.sources.length > 0 ? (
        <>
          <h3>来源记录</h3>
          {work.sources.map((source) => (
            <article className="work-card" key={source.id}>
              <strong>{source.title ?? source.url ?? `来源 #${source.id}`}</strong>
              <div className="tag-row">
                {source.sourceType ? <span className="tag">{source.sourceType}</span> : null}
                {source.evidenceLevel ? <span className="tag">{source.evidenceLevel}</span> : null}
              </div>
              {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.url}</a> : null}
              {source.note ? <p>{source.note}</p> : null}
            </article>
          ))}
        </>
      ) : null}

      {work.externalLinks && work.externalLinks.length > 0 ? (
        <>
          <h3>外部链接</h3>
          {work.externalLinks.map((link) => (
            <article className="work-card" key={link.id}>
              <strong>{link.title ?? link.url ?? `外链 #${link.id}`}</strong>
              <div className="tag-row">
                <span className="tag">{link.targetType}</span>
                {link.relationType ? <span className="tag">{link.relationType}</span> : null}
              </div>
              {link.url ? <a href={link.url} target="_blank" rel="noreferrer">{link.url}</a> : null}
              {link.note ? <p>{link.note}</p> : null}
            </article>
          ))}
        </>
      ) : null}

      <h2>关联作品</h2>
      {relationGroups.length === 0 ? <p className="muted">暂无关联作品。</p> : null}
      {relationGroups.map((group) => (
        <section className="inline-section" key={group.group}>
          <h3>{group.label}</h3>
          {group.items.map((relation) => (
            <article className="work-card" key={`${relation.relationId}-${relation.workId}-${relation.reverse}`}>
              <strong>{relation.title}</strong>
              <div className="tag-row">
                <span className="tag">{relation.label}</span>
                {relation.year ? <span className="tag">{relation.year}</span> : null}
              </div>
              {relation.note ? <p>{relation.note}</p> : null}
            </article>
          ))}
        </section>
      ))}

      <h2>版本记录</h2>
      {work.releases.length === 0 ? <p className="muted">暂无版本记录。</p> : null}
      {work.releases.map((release) => (
        <section className="work-card" key={release.releaseId}>
          <strong>{release.releaseTitle ?? release.releaseId}</strong>
          <div className="tag-row">
            {release.releaseDate ? <span className="tag">{release.releaseDate}</span> : null}
            {release.resolution ? <span className="tag">{release.resolution}</span> : null}
            <span className="tag">{release.releaseStatus}</span>
          </div>
          {release.qualityNote ? <p>{release.qualityNote}</p> : null}
          <h3>获取方式</h3>
          {!release.accessEntries || release.accessEntries.length === 0 ? <p className="muted">暂无公开获取方式。</p> : null}
          {release.accessEntries?.map((entry) => (
            <article key={entry.accessId ?? `${release.releaseId}-${entry.platform}`} className="work-card">
              <strong>{entry.platform ?? entry.accessType ?? "获取方式"}</strong>
              <div className="tag-row">
                {entry.accessType ? <span className="tag">{entry.accessType}</span> : null}
                {entry.availability ? <span className="tag">{entry.availability}</span> : null}
              </div>
              {entry.url ? <a href={entry.url} target="_blank" rel="noreferrer">{entry.url}</a> : null}
              {entry.accessNote ? <p>{entry.accessNote}</p> : null}
            </article>
          ))}
        </section>
      ))}
    </article>
  );
}
