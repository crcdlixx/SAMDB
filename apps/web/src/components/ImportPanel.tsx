type ImportPanelProps = {
  onOpenWorkbench?: () => void;
};

export function ImportPanel({ onOpenWorkbench }: ImportPanelProps) {
  return (
    <details className="work-card">
      <summary>导入 Markdown/YAML</summary>
      <p className="muted">
        即时单条导入已升级为导入治理工作台。请使用预览任务批量导入，并在执行前自动备份。
      </p>
      {onOpenWorkbench ? (
        <button type="button" onClick={onOpenWorkbench}>打开导入治理工作台</button>
      ) : null}
    </details>
  );
}
