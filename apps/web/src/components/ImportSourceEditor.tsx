type ImportSourceEditorProps = {
  onPreview: (markdown: string) => Promise<void>;
  disabled?: boolean;
};

const sampleBatch = `---
id: new-work-sample
title: 新作品示例
summaryShort: 这是一条全新的作品资料。
sourcePrimary: https://example.test/new-work
recordStatus: draft
visibility: public
---

# 新作品示例

---
id: duplicate-id-sample
title: 可能重复的作品
summaryShort: 这条可能与现有作品 ID 冲突。
sourcePrimary: https://example.test/duplicate
recordStatus: draft
visibility: public
---

# 可能重复的作品
`;

export function ImportSourceEditor({ onPreview, disabled }: ImportSourceEditorProps) {
  return (
    <details className="work-card" open>
      <summary>批量粘贴 Markdown/YAML</summary>
      <p className="muted">每份 frontmatter 文档代表一个候选项。预览阶段不会写入作品表。</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const textarea = form.elements.namedItem("markdown") as HTMLTextAreaElement;
          void onPreview(textarea.value);
        }}
      >
        <textarea name="markdown" className="import-textarea" defaultValue={sampleBatch} disabled={disabled} />
        <button type="submit" disabled={disabled}>创建预览任务</button>
      </form>
    </details>
  );
}
