import { useState } from "react";
import { bootstrapOwner, login, type AuthUser } from "../api";
import { Button, Field, InlineNotice } from "../components/ui";

type LoginPageProps = {
  mode: "bootstrap" | "login";
  onAuthenticated: (user: AuthUser, token: string) => void;
};

export function LoginPage({ mode, onAuthenticated }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = mode === "bootstrap"
        ? await bootstrapOwner({ username, displayName: displayName || null, password })
        : await login({ username, password });
      onAuthenticated(result.user, result.token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    }
  }

  return (
    <section className="auth-page">
      <h1>{mode === "bootstrap" ? "初始化管理员" : "登录后台"}</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <Field label="用户名" inputProps={{ value: username, onChange: (event) => setUsername(event.target.value) }} />
        {mode === "bootstrap" ? (
          <Field label="显示名" inputProps={{ value: displayName, onChange: (event) => setDisplayName(event.target.value) }} />
        ) : null}
        <Field label="密码" inputProps={{ type: "password", value: password, onChange: (event) => setPassword(event.target.value) }} />
        {message ? <InlineNotice tone="error">{message}</InlineNotice> : null}
        <Button type="submit">{mode === "bootstrap" ? "创建管理员" : "登录"}</Button>
      </form>
    </section>
  );
}
