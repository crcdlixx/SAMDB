import { useEffect, useState } from "react";
import { fetchWorks, type Work } from "../api";
import { WorkCard } from "../components/WorkCard";

type WorksPageProps = {
  onOpenWork: (id: string) => void;
};

export function WorksPage({ onOpenWork }: WorksPageProps) {
  const [query, setQuery] = useState("");
  const [works, setWorks] = useState<Work[]>([]);
  const [density, setDensity] = useState<"card" | "list">("card");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorks(query).then((result) => {
      setWorks(result.items);
      setError(null);
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "加载失败");
    });
  }, [query]);

  return (
    <section>
      <div className="toolbar compact-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索标题、别名"
        />
        <div className="segmented-control" aria-label="作品列表密度">
          <button
            className={density === "card" ? "active" : ""}
            onClick={() => setDensity("card")}
            type="button"
          >
            卡片
          </button>
          <button
            className={density === "list" ? "active" : ""}
            onClick={() => setDensity("list")}
            type="button"
          >
            列表
          </button>
        </div>
      </div>
      {error ? <p>{error}</p> : null}
      {works.length === 0 ? <p className="muted">暂无作品。</p> : null}
      <div className={density === "card" ? "work-grid" : "work-compact-list"} role="list" aria-label="作品列表">
        {works.map((work) => (
          density === "card" ? (
            <WorkCard key={work.id} work={work} onOpen={onOpenWork} />
          ) : (
            <button
              aria-label={work.title}
              className="work-compact-row"
              key={work.id}
              onClick={() => onOpenWork(work.id)}
              type="button"
            >
              <div>
                <strong>{work.title}</strong>
                {work.titleOriginal ? <span className="muted">{work.titleOriginal}</span> : null}
              </div>
              <span className="muted">{work.year ?? "年份未定"}</span>
              <span className="muted">{work.tags.slice(0, 2).join(" / ") || "未标注"}</span>
              <span className="tag">{work.recordStatus}</span>
            </button>
          )
        ))}
      </div>
    </section>
  );
}
