import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardPage } from "./AdminDashboardPage";
import * as api from "../api";

vi.mock("./AdminWorksPage", () => ({ AdminWorksPage: () => <div data-testid="admin-works" /> }));
vi.mock("./AdminRelationsPage", () => ({ AdminRelationsPage: () => <div data-testid="admin-relations" /> }));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    createAdminUser: vi.fn(),
    fetchAdminUsers: vi.fn(),
    updateAdminUser: vi.fn()
  };
});

const owner: api.AuthUser = {
  id: "owner-id",
  username: "owner",
  displayName: null,
  role: "owner",
  isActive: true
};

describe("AdminDashboardPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAdminUsers).mockResolvedValue({
      items: [
        owner,
        { id: "editor-id", username: "editor", displayName: null, role: "editor", isActive: true }
      ]
    });
  });

  it("lets owners open the user and settings modules", async () => {
    render(<AdminDashboardPage user={owner} onLogout={vi.fn()} />);

    const nav = screen.getByRole("navigation", { name: "后台模块" });
    await userEvent.click(within(nav).getByRole("button", { name: "用户与权限" }));
    expect(await screen.findByRole("heading", { name: "用户与权限" })).toBeInTheDocument();
    expect(screen.getByText((text, element) => element?.tagName.toLowerCase() === "strong" && text === "editor")).toBeInTheDocument();

    await userEvent.click(within(nav).getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
  });

  it("hides owner-only modules from editors", () => {
    render(<AdminDashboardPage user={{ ...owner, username: "editor", role: "editor" }} onLogout={vi.fn()} />);

    const nav = screen.getByRole("navigation", { name: "后台模块" });
    expect(within(nav).queryByRole("button", { name: "用户与权限" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "设置" })).not.toBeInTheDocument();
  });
});
