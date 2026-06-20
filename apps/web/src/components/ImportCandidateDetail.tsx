import type { ImportCandidate } from "../api";
import { DuplicateMatchPanel } from "./DuplicateMatchPanel";

type ImportCandidateDetailProps = {
  candidate: ImportCandidate | null;
  canEdit?: boolean;
  onUpdate: (patch: { action?: ImportCandidate["action"]; targetWorkId?: string | null }) => void;
};

export function ImportCandidateDetail({ candidate, canEdit, onUpdate }: ImportCandidateDetailProps) {
  if (!candidate) {
    return <p className="muted">选择一个候选项查看详情。</p>;
  }

  return (
    <div className="import-candidate-detail">
      <h3>候选项详情</h3>
      <p><strong>{candidate.proposedTitle ?? "(无标题)"}</strong></p>
      <p className="muted">#{candidate.sourceIndex + 1} · {candidate.status}</p>

      <h4>解析字段</h4>
      <pre className="parsed-json">{JSON.stringify(candidate.parsed, null, 2)}</pre>

      <h4>预检问题</h4>
      {candidate.issues.length === 0 ? <p className="muted">无问题</p> : (
        <ul>
          {candidate.issues.map((issue) => (
            <li key={issue.id} className={`issue-${issue.severity}`}>
              [{issue.severity}] {issue.message}
            </li>
          ))}
        </ul>
      )}

      <DuplicateMatchPanel matches={candidate.matches} />

      <h4>动作</h4>
      <label>
        选择动作
        <select
          value={candidate.action}
          disabled={!canEdit}
          onChange={(event) => onUpdate({ action: event.target.value as ImportCandidate["action"] })}
        >
          <option value="create">create</option>
          <option value="skip">skip</option>
          <option value="overwrite">overwrite</option>
          <option value="merge">merge</option>
          <option value="needs_review">needs_review</option>
        </select>
      </label>

      {(candidate.action === "overwrite" || candidate.action === "merge") ? (
        <label>
          目标作品 ID
          <input
            value={candidate.targetWorkId ?? ""}
            disabled={!canEdit}
            onChange={(event) => onUpdate({ targetWorkId: event.target.value || null })}
          />
        </label>
      ) : null}

      {candidate.resultWorkId ? <p>结果作品：{candidate.resultWorkId}</p> : null}
      {candidate.errorMessage ? <p className="notice error">{candidate.errorMessage}</p> : null}
    </div>
  );
}
