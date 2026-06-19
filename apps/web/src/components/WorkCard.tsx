import type { Work } from "../api";

type WorkCardProps = {
  work: Work;
  onOpen: (id: string) => void;
};

export function WorkCard({ work, onOpen }: WorkCardProps) {
  return (
    <button
      aria-label={work.title}
      className="work-card work-card-button"
      onClick={() => onOpen(work.id)}
      type="button"
    >
      <strong>{work.title}</strong>
      {work.titleOriginal ? <span className="muted">{work.titleOriginal}</span> : null}
      <p>{work.summaryShort}</p>
      <div className="tag-row">
        {work.year ? <span className="tag">{work.year}</span> : null}
        {work.language ? <span className="tag">{work.language}</span> : null}
        {work.tags.slice(0, 3).map((tag) => (
          <span className="tag" key={tag}>{tag}</span>
        ))}
      </div>
    </button>
  );
}
