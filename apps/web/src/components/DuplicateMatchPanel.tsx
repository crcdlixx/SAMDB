import type { ImportCandidate } from "../api";

type DuplicateMatchPanelProps = {
  matches: ImportCandidate["matches"];
};

export function DuplicateMatchPanel({ matches }: DuplicateMatchPanelProps) {
  return (
    <section>
      <h4>重复匹配</h4>
      {matches.length === 0 ? <p className="muted">未检测到重复</p> : (
        <ul>
          {matches.map((match) => (
            <li key={match.id}>
              <strong>{match.matchType}</strong> · {match.existingTitle ?? match.existingWorkId}
              <span className="muted"> (score {match.score})</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
