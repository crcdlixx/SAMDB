import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EvidencePanel } from "./EvidencePanel";
import * as api from "../api";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    createAdminExternalLink: vi.fn(),
    createAdminSource: vi.fn(),
    deleteAdminExternalLink: vi.fn(),
    deleteAdminSource: vi.fn(),
    fetchAdminExternalLinks: vi.fn(),
    fetchAdminSources: vi.fn(),
    updateAdminExternalLink: vi.fn(),
    updateAdminSource: vi.fn()
  };
});

describe("EvidencePanel", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAdminSources).mockResolvedValue({
      items: [{
        id: 1,
        workId: "work-one",
        sourceType: "official",
        url: "https://example.test/source",
        title: "Official source",
        evidenceLevel: "primary",
        note: null,
        visibility: "public",
        lastChecked: null,
        createdAt: "2026-06-14T00:00:00.000Z",
        updatedAt: "2026-06-14T00:00:00.000Z"
      }]
    });
    vi.mocked(api.fetchAdminExternalLinks).mockResolvedValue({
      items: [{
        id: 2,
        workId: "work-one",
        targetType: "official_site",
        title: "Official site",
        url: "https://example.test/official",
        relationType: "homepage",
        visibility: "public",
        note: null,
        createdAt: "2026-06-14T00:00:00.000Z",
        updatedAt: "2026-06-14T00:00:00.000Z"
      }]
    });
    vi.mocked(api.createAdminSource).mockResolvedValue({} as api.Source);
    vi.mocked(api.createAdminExternalLink).mockResolvedValue({} as api.ExternalLink);
    vi.mocked(api.deleteAdminSource).mockResolvedValue(undefined);
    vi.mocked(api.deleteAdminExternalLink).mockResolvedValue(undefined);
    vi.mocked(api.updateAdminSource).mockResolvedValue({} as api.Source);
    vi.mocked(api.updateAdminExternalLink).mockResolvedValue({} as api.ExternalLink);
  });

  it("loads and creates sources for a work", async () => {
    render(<EvidencePanel workId="work-one" />);

    expect(await screen.findByText("Official source")).toBeInTheDocument();
    expect(await screen.findByText("Official site")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("来源标题"), "New source");
    await userEvent.type(screen.getByLabelText("来源 URL"), "https://example.test/new-source");
    await userEvent.click(screen.getByRole("button", { name: "添加来源" }));

    await waitFor(() => {
      expect(api.createAdminSource).toHaveBeenCalledWith("work-one", expect.objectContaining({
        title: "New source",
        url: "https://example.test/new-source",
        visibility: "public"
      }));
    });
  });

  it("can hide a source and delete an external link", async () => {
    render(<EvidencePanel workId="work-one" />);

    await screen.findByText("Official source");
    await userEvent.click(screen.getByRole("button", { name: "隐藏来源：Official source" }));
    await userEvent.click(screen.getByRole("button", { name: "删除外链：Official site" }));

    await waitFor(() => {
      expect(api.updateAdminSource).toHaveBeenCalledWith(1, expect.objectContaining({
        visibility: "internal"
      }));
      expect(api.deleteAdminExternalLink).toHaveBeenCalledWith(2);
    });
  });
});
