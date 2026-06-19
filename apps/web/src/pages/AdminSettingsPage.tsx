export function AdminSettingsPage() {
  return (
    <section className="module-section">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>设置</h2>
          <p className="muted">当前阶段只展示关键运行配置，后续可逐步开放可编辑项。</p>
        </div>
      </header>
      <div className="settings-grid">
        <article className="settings-item">
          <strong>数据库</strong>
          <p className="muted">本地 SQLite，数据库路径由 API 环境变量控制。</p>
        </article>
        <article className="settings-item">
          <strong>公开端</strong>
          <p className="muted">公共 API 只返回公开作品、公开关系和允许展示的获取方式。</p>
        </article>
        <article className="settings-item">
          <strong>权限</strong>
          <p className="muted">账号和角色完全存放在本地数据库，owner 可维护用户。</p>
        </article>
      </div>
    </section>
  );
}
