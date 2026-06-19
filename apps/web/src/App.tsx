import { useState } from "react";
import type { AuthUser } from "./api";
import { fetchAuthMe, fetchBootstrapStatus, logout } from "./api";
import { clearAuthToken, getAuthToken, setAuthToken } from "./auth";
import { AppShell } from "./components/AppShell";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { SeriesPage } from "./pages/SeriesPage";
import { WorkDetailPage } from "./pages/WorkDetailPage";
import { WorksPage } from "./pages/WorksPage";

type PageState =
  | { name: "works" }
  | { name: "series" }
  | { name: "workDetail"; id: string }
  | { name: "admin" }
  | { name: "auth"; mode: "bootstrap" | "login" };

export function App() {
  const [page, setPage] = useState<PageState>({ name: "works" });
  const [user, setUser] = useState<AuthUser | null>(null);

  async function openAdmin() {
    const token = getAuthToken();
    if (token) {
      try {
        const me = await fetchAuthMe();
        setUser(me.user);
        setPage({ name: "admin" });
        return;
      } catch {
        clearAuthToken();
        setUser(null);
      }
    }

    const status = await fetchBootstrapStatus();
    setPage({ name: "auth", mode: status.needsBootstrap ? "bootstrap" : "login" });
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      clearAuthToken();
      setUser(null);
      setPage({ name: "works" });
    }
  }

  return (
    <AppShell
      user={user}
      onNavigate={(name) => {
        if (name === "works") setPage({ name: "works" });
        if (name === "series") setPage({ name: "series" });
        if (name === "admin") void openAdmin();
      }}
    >
      {page.name === "works" ? (
        <WorksPage onOpenWork={(id) => setPage({ name: "workDetail", id })} />
      ) : null}
      {page.name === "series" ? (
        <SeriesPage onOpenWork={(id) => setPage({ name: "workDetail", id })} />
      ) : null}
      {page.name === "workDetail" ? (
        <WorkDetailPage id={page.id} onBack={() => setPage({ name: "works" })} />
      ) : null}
      {page.name === "auth" ? (
        <LoginPage
          mode={page.mode}
          onAuthenticated={(nextUser, token) => {
            setAuthToken(token);
            setUser(nextUser);
            setPage({ name: "admin" });
          }}
        />
      ) : null}
      {page.name === "admin" && user ? <AdminDashboardPage user={user} onLogout={() => void handleLogout()} /> : null}
    </AppShell>
  );
}
