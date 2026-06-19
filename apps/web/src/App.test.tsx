import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import * as api from "./api";
import * as auth from "./auth";

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    bootstrapOwner: vi.fn(),
    fetchAuthMe: vi.fn(),
    fetchBootstrapStatus: vi.fn(),
    fetchWorks: vi.fn(),
    login: vi.fn(),
    logout: vi.fn()
  };
});

describe("App auth flow", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    auth.clearAuthToken();
    vi.mocked(api.fetchWorks).mockResolvedValue({ items: [] });
    vi.mocked(api.fetchAuthMe).mockRejectedValue(new Error("Unauthorized"));
  });

  it("opens owner bootstrap when admin is selected before any user exists", async () => {
    vi.mocked(api.fetchBootstrapStatus).mockResolvedValue({ needsBootstrap: true });

    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "后台" }));

    expect(await screen.findByRole("heading", { name: "初始化管理员" })).toBeInTheDocument();
    expect(screen.getByLabelText("用户名")).toBeInTheDocument();
  });

  it("opens login when bootstrap is complete but no token exists", async () => {
    vi.mocked(api.fetchBootstrapStatus).mockResolvedValue({ needsBootstrap: false });

    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "后台" }));

    expect(await screen.findByRole("heading", { name: "登录后台" })).toBeInTheDocument();
  });

  it("shows admin navigation after login", async () => {
    vi.mocked(api.fetchBootstrapStatus).mockResolvedValue({ needsBootstrap: false });
    vi.mocked(api.login).mockResolvedValue({
      token: "token-one",
      user: { id: "user-one", username: "editor", displayName: null, role: "editor", isActive: true },
      expiresAt: "2026-07-01T00:00:00.000Z"
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "后台" }));
    await userEvent.type(await screen.findByLabelText("用户名"), "editor");
    await userEvent.type(screen.getByLabelText("密码"), "editor-password");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      const adminNav = screen.getByRole("navigation", { name: "后台模块" });
      expect(adminNav).toBeInTheDocument();
      expect(within(adminNav).getByRole("button", { name: "作品" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "用户与权限" })).not.toBeInTheDocument();
    });
  });

  it("logs out from the admin shell and clears the local token", async () => {
    auth.setAuthToken("token-one");
    vi.mocked(api.fetchAuthMe).mockResolvedValue({
      user: { id: "owner-id", username: "owner", displayName: null, role: "owner", isActive: true }
    });
    vi.mocked(api.logout).mockResolvedValue();

    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "后台" }));
    await userEvent.click(await screen.findByRole("button", { name: "退出登录" }));

    await waitFor(() => {
      expect(api.logout).toHaveBeenCalledTimes(1);
      expect(auth.getAuthToken()).toBeNull();
      expect(screen.queryByRole("navigation", { name: "后台模块" })).not.toBeInTheDocument();
    });
  });
});
