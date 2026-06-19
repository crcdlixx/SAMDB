import { useEffect, useState } from "react";
import { fetchAdminRelationQuality } from "../api";

type RelationIssue = {
  issueType: string;
  relationId: number;
  message: string;
};

export function AdminRelationsPage() {
  const [issues, setIssues] = useState<RelationIssue[]>([]);
  const [message, setMessage] = useState("");

  async function loadIssues() {
    try {
      const result = await fetchAdminRelationQuality();
      setIssues(result.items);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载关系检查失败");
    }
  }

  useEffect(() => {
    void loadIssues();
  }, []);

  return (
    <section className="module-section">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Relations</p>
          <h2>关系检查</h2>
        </div>
        <button type="button" onClick={() => void loadIssues()}>刷新</button>
      </header>
      {message ? <p className="notice error">{message}</p> : null}
      {issues.length === 0 ? <p className="muted">未发现关系质量问题。</p> : null}
      <div className="data-list">
        {issues.map((issue) => (
          <article className="list-row static" key={`${issue.issueType}-${issue.relationId}`}>
            <span className="tag">{issue.issueType}</span>
            <strong>关系 #{issue.relationId}</strong>
            <p>{issue.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
