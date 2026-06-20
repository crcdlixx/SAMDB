import type { ImportCandidate } from "../api";

type ImportPreviewTableProps = {
  candidates: ImportCandidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ImportPreviewTable({ candidates, selectedId, onSelect }: ImportPreviewTableProps) {
  return (
    <div className="import-preview-table">
      <h3>候选项</h3>
      <table>
        <thead>
          <tr>
            <th>标题</th>
            <th>ID</th>
            <th>状态</th>
            <th>重复</th>
            <th>动作</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr
              key={candidate.id}
              className={selectedId === candidate.id ? "selected" : ""}
              onClick={() => onSelect(candidate.id)}
            >
              <td>{candidate.proposedTitle ?? "(无标题)"}</td>
              <td><code>{candidate.proposedWorkId ?? "-"}</code></td>
              <td>
                <span className={`tag ${candidate.status}`}>{candidate.status}</span>
                {candidate.issues.some((i) => i.severity === "error") ? <span className="tag error">error</span> : null}
                {candidate.issues.some((i) => i.severity === "warning") ? <span className="tag warning">warning</span> : null}
              </td>
              <td>{candidate.matches.length}</td>
              <td>{candidate.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
