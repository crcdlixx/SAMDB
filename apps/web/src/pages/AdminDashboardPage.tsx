import { useState } from "react";
import type { AuthUser } from "../api";
import { AdminRelationsPage } from "./AdminRelationsPage";
import { AdminSettingsPage } from "./AdminSettingsPage";
import { AdminUsersPage } from "./AdminUsersPage";
import { AdminWorksPage } from "./AdminWorksPage";
import { AdminImportWorkbenchPage } from "./AdminImportWorkbenchPage";

type AdminDashboardPageProps = {
  user: AuthUser;
  onLogout?: () => void;
};

type AdminModule = "overview" | "works" | "relations" | "taxonomy" | "import-export" | "import-governance" | "users" | "audit" | "settings";

export function AdminDashboardPage({ user, onLogout }: AdminDashboardPageProps) {
  const [activeModule, setActiveModule] = useState<AdminModule>("overview");
  const canManageUsers = user.role === "owner";
  const canReadAudit = user.role === "owner" || user.role === "reviewer";
  const showUsers = activeModule === "users" && canManageUsers;
  const showSettings = activeModule === "settings" && canManageUsers;
  const showRelations = activeModule === "relations";
  const canImport = user.role === "owner" || user.role === "editor";
  const showImportGovernance = activeModule === "import-governance";
  const showWorks = activeModule === "works" || activeModule === "overview" || activeModule === "taxonomy" || activeModule === "import-export" || activeModule === "audit";
  const navButton = (module: AdminModule, label: string) => (
    <button
      className={activeModule === module ? "active" : ""}
      onClick={() => setActiveModule(module)}
      type="button"
    >
      {label}
    </button>
  );

  return (
    <section className="admin-shell">
      <aside className="admin-sidebar">
        <nav aria-label="后台模块">
          {navButton("overview", "总览")}
          {navButton("works", "作品")}
          {navButton("relations", "关系")}
          {navButton("taxonomy", "分类")}
          {navButton("import-export", "导入导出")}
          {navButton("import-governance", "导入治理")}
          {canManageUsers ? navButton("users", "用户与权限") : null}
          {canReadAudit ? navButton("audit", "审计日志") : null}
          {canManageUsers ? navButton("settings", "设置") : null}
          {onLogout ? <button className="ghost" onClick={onLogout} type="button">退出登录</button> : null}
        </nav>
      </aside>
      <div className="admin-main">
        <header className="section-heading">
          <div>
            <p className="eyebrow">后台</p>
            <h1>资料维护</h1>
          </div>
          <span className="tag">{user.role}</span>
        </header>
        {showUsers ? <AdminUsersPage /> : null}
        {showSettings ? <AdminSettingsPage /> : null}
        {showRelations ? <AdminRelationsPage /> : null}
        {showImportGovernance ? <AdminImportWorkbenchPage user={user} /> : null}
        {showWorks ? (
          <>
            {activeModule === "overview" ? <AdminRelationsPage /> : null}
            <AdminWorksPage onOpenImportGovernance={canImport ? () => setActiveModule("import-governance") : undefined} />
          </>
        ) : null}
      </div>
    </section>
  );
}
