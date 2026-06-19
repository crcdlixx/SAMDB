import { useEffect, useState, type FormEvent } from "react";
import { createAdminUser, fetchAdminUsers, updateAdminUser, type AuthUser } from "../api";

type ManagedRole = Exclude<AuthUser["role"], "public">;

const roles: ManagedRole[] = ["owner", "editor", "reviewer", "viewer"];
const roleLabels: Record<ManagedRole, string> = {
  owner: "系统所有者",
  editor: "资料编辑",
  reviewer: "审核员",
  viewer: "只读查看"
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<ManagedRole>("viewer");
  const [message, setMessage] = useState("");

  async function loadUsers() {
    try {
      const result = await fetchAdminUsers();
      setUsers(result.items);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载用户失败");
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createAdminUser({ username, password, displayName: displayName || null, role });
      setUsername("");
      setDisplayName("");
      setPassword("");
      setRole("viewer");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建用户失败");
    }
  }

  async function handleUpdate(user: AuthUser, patch: Partial<Pick<AuthUser, "role" | "displayName" | "isActive">>) {
    try {
      await updateAdminUser(user.username, patch);
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新用户失败");
    }
  }

  return (
    <section className="module-section">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Users</p>
          <h2>用户与权限</h2>
          <p className="muted">本地账号、后台角色和启停状态集中维护。</p>
        </div>
        <button type="button" onClick={() => void loadUsers()}>刷新</button>
      </header>
      {message ? <p className="notice error">{message}</p> : null}
      <form className="user-create-form" onSubmit={handleCreate}>
        <div>
          <h3>新建用户</h3>
          <p className="muted">创建后可直接调整角色或停用账号。</p>
        </div>
        <label>
          用户名
          <input required value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          显示名
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label>
          密码
          <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label>
          角色
          <select value={role} onChange={(event) => setRole(event.target.value as ManagedRole)}>
            {roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
          </select>
        </label>
        <button type="submit">创建用户</button>
      </form>
      <div className="user-list">
        {users.map((user) => (
          <article className="user-row" key={user.id}>
            <div>
              <strong>{user.username}</strong>
              <span className="muted">{user.displayName ?? "未设置显示名"}</span>
            </div>
            <div className="user-role-cell">
              <span className="tag">{user.role === "public" ? "公开访问" : roleLabels[user.role]}</span>
              <span className={`status-dot ${user.isActive ? "on" : "off"}`}>{user.isActive ? "启用" : "禁用"}</span>
            </div>
            <div className="user-actions">
              <select
                aria-label={`${user.username} 的角色`}
                value={user.role}
                onChange={(event) => void handleUpdate(user, { role: event.target.value as ManagedRole })}
              >
                {roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
              </select>
              <button type="button" onClick={() => void handleUpdate(user, { isActive: !user.isActive })}>
                {user.isActive ? "禁用" : "启用"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
