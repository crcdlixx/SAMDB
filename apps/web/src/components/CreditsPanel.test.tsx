import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreditsPanel } from "./CreditsPanel";
import * as api from "../api";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    createAdminContributor: vi.fn(),
    createAdminCover: vi.fn(),
    deleteAdminContributor: vi.fn(),
    deleteAdminCover: vi.fn(),
    fetchAdminContributors: vi.fn(),
    fetchAdminCovers: vi.fn(),
    updateAdminContributor: vi.fn(),
    updateAdminCover: vi.fn()
  };
});

describe("CreditsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(api.fetchAdminContributors).mockResolvedValue({
      items: [{
        id: 1,
        workId: "work-one",
        name: "Lead Artist",
        role: "artist",
        creditName: "L. Artist",
        note: null,
        visibility: "public",
        createdAt: "2026-06-15T00:00:00.000Z",
        updatedAt: "2026-06-15T00:00:00.000Z"
      }]
    });
    vi.mocked(api.fetchAdminCovers).mockResolvedValue({
      items: [{
        id: "cover-main",
        workId: "work-one",
        releaseId: null,
        url: "/assets/covers/work-one-main.jpg",
        source: "local",
        isPrimary: true,
        processNote: null,
        visibility: "public",
        createdAt: "2026-06-15T00:00:00.000Z",
        updatedAt: "2026-06-15T00:00:00.000Z"
      }]
    });
    vi.mocked(api.createAdminContributor).mockResolvedValue({} as api.Contributor);
    vi.mocked(api.createAdminCover).mockResolvedValue({} as api.Cover);
    vi.mocked(api.deleteAdminContributor).mockResolvedValue(undefined);
    vi.mocked(api.deleteAdminCover).mockResolvedValue(undefined);
    vi.mocked(api.updateAdminContributor).mockResolvedValue({} as api.Contributor);
    vi.mocked(api.updateAdminCover).mockResolvedValue({} as api.Cover);
  });

  it("loads and creates contributors for a work", async () => {
    render(<CreditsPanel workId="work-one" />);

    expect(await screen.findByText("Lead Artist")).toBeInTheDocument();
    expect(await screen.findByText("/assets/covers/work-one-main.jpg")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("署名"), "Director");
    await userEvent.type(screen.getByLabelText("角色"), "director");
    await userEvent.click(screen.getByRole("button", { name: "添加制作人员" }));

    await waitFor(() => {
      expect(api.createAdminContributor).toHaveBeenCalledWith("work-one", expect.objectContaining({
        name: "Director",
        role: "director",
        visibility: "public"
      }));
    });
  });

  it("can hide a contributor and delete a cover", async () => {
    render(<CreditsPanel workId="work-one" />);

    await screen.findByText("Lead Artist");
    await userEvent.click(screen.getByRole("button", { name: "设为内部：Lead Artist" }));
    await userEvent.click(screen.getByRole("button", { name: "删除封面：cover-main" }));

    await waitFor(() => {
      expect(api.updateAdminContributor).toHaveBeenCalledWith(1, expect.objectContaining({
        visibility: "internal"
      }));
      expect(api.deleteAdminCover).toHaveBeenCalledWith("cover-main");
    });
  });
});
