import { useEffect, useState } from "react";
import { fetchPublicSeries, fetchPublicSeriesDetail, type SeriesDetail, type SeriesSummary } from "../api";

type SeriesPageProps = {
  onOpenWork: (id: string) => void;
};

export function SeriesPage({ onOpenWork }: SeriesPageProps) {
  const [series, setSeries] = useState<SeriesSummary[]>([]);
  const [selected, setSelected] = useState<SeriesDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicSeries().then((result) => {
      setSeries(result.items);
      setError(null);
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "加载系列失败");
    });
  }, []);

  async function openSeries(name: string) {
    try {
      setSelected(await fetchPublicSeriesDetail(name));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载系列详情失败");
    }
  }

  return (
    <section>
      <header className="section-heading">
        <div>
          <p className="eyebrow">Series</p>
          <h1>系列</h1>
        </div>
      </header>
      {error ? <p className="notice error">{error}</p> : null}
      <div className="split-view">
        <div className="list-panel">
          {series.length === 0 ? <p className="muted">暂无系列。</p> : null}
          {series.map((item) => (
            <button
              aria-label={`${item.name} ${item.workCount} 部作品`}
              className="list-row"
              key={item.name}
              onClick={() => void openSeries(item.name)}
              type="button"
            >
              <strong>{item.name}</strong>
              <span>{item.workCount} 部作品</span>
            </button>
          ))}
        </div>
        <div className="detail-panel">
          {!selected ? <p className="muted">选择一个系列查看时间线。</p> : null}
          {selected ? (
            <>
              <h2>{selected.name}</h2>
              <ol className="timeline" aria-label={`${selected.name} 时间线`}>
                {selected.works.map((work) => (
                  <li key={work.id}>
                    <button
                      aria-label={`${work.year ?? "年份未定"} ${work.title} ${work.summaryShort}`}
                      className="timeline-item"
                      onClick={() => onOpenWork(work.id)}
                      type="button"
                    >
                      <span>{work.year ?? "年份未定"}</span>
                      <strong>{work.title}</strong>
                      <small>{work.summaryShort}</small>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
