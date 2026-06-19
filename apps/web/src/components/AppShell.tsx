import type { ReactNode } from "react";
import type { AuthUser } from "../api";

type AppShellProps = {
  children: ReactNode;
  user?: AuthUser | null;
  onNavigate: (page: "works" | "series" | "admin") => void;
};

export function AppShell({ children, user, onNavigate }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">SAMDB</div>
        <nav className="nav">
          <button onClick={() => onNavigate("works")}>作品</button>
          <button onClick={() => onNavigate("series")}>系列</button>
          <button onClick={() => onNavigate("admin")}>后台</button>
        </nav>
        {user ? <span className="user-chip">{user.username}</span> : null}
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
