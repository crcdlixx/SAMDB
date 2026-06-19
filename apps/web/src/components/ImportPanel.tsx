import { useState } from "react";
import { importAdminWork } from "../api";

type ImportPanelProps = {
  onImported: (workId: string) => Promise<void>;
};

const sampleMarkdown = `---
id: imported-sample
title: 导入示例作品
aliases:
  - Imported Sample
tags:
  - 导入
summaryShort: 通过 Markdown/YAML 导入的示例作品。
sourcePrimary: https://example.test/imported-sample
recordStatus: draft
visibility: public
---

# 导入示例作品
`;

export function ImportPanel({ onImported }: ImportPanelProps) {
  const [markdown, setMarkdown] = useState(sampleMarkdown);
  const [message, setMessage] = useState("");

  async function handleImport() {
    try {
      const work = await importAdminWork(markdown);
      setMessage(`已导入 ${work.title}`);
      await onImported(work.id);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "导入失败");
    }
  }

  return (
    <details className="work-card">
      <summary>导入 Markdown/YAML</summary>
      <textarea
        value={markdown}
        onChange={(event) => setMarkdown(event.target.value)}
        className="import-textarea"
      />
      <button onClick={handleImport}>导入作品</button>
      {message ? <p>{message}</p> : null}
    </details>
  );
}
