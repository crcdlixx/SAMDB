import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaxonomyPanel } from "./TaxonomyPanel";
import * as api from "../api";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    attachAdminTaxonomyTerm: vi.fn(),
    createAdminTaxonomy: vi.fn(),
    createAdminTaxonomyTerm: vi.fn(),
    detachAdminTaxonomyTerm: vi.fn(),
    fetchAdminTaxonomies: vi.fn(),
    fetchAdminTaxonomyTerms: vi.fn(),
    fetchAdminWorkTaxonomyTerms: vi.fn()
  };
});

describe("TaxonomyPanel", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAdminTaxonomies).mockResolvedValue({
      items: [{
        id: "tax-theme",
        code: "theme",
        name: "主题",
        description: null
      }]
    });
    vi.mocked(api.fetchAdminTaxonomyTerms).mockResolvedValue({
      items: [{
        id: "term-fanwork",
        taxonomy_id: "tax-theme",
        parent_id: null,
        label: "二创",
        slug: "fanwork",
        description: null
      }]
    });
    vi.mocked(api.fetchAdminWorkTaxonomyTerms).mockResolvedValue({
      items: [{
        id: 12,
        work_id: "work-one",
        term_id: "term-fanwork",
        relation_type: "theme",
        confidence: "manual",
        note: null,
        label: "二创",
        slug: "fanwork",
        taxonomy_code: "theme",
        taxonomy_name: "主题"
      }]
    });
    vi.mocked(api.attachAdminTaxonomyTerm).mockResolvedValue({ ok: true });
    vi.mocked(api.detachAdminTaxonomyTerm).mockResolvedValue(undefined);
    vi.mocked(api.createAdminTaxonomy).mockResolvedValue({ ok: true });
    vi.mocked(api.createAdminTaxonomyTerm).mockResolvedValue({ ok: true });
  });

  it("attaches and detaches taxonomy terms", async () => {
    render(<TaxonomyPanel workId="work-one" />);

    expect(await screen.findByRole("button", { name: "移除分类：theme: 二创" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "挂载分类项" }));
    await userEvent.click(screen.getByRole("button", { name: "移除分类：theme: 二创" }));

    await waitFor(() => {
      expect(api.attachAdminTaxonomyTerm).toHaveBeenCalledWith("work-one", expect.objectContaining({
        termId: "term-fanwork",
        relationType: "theme"
      }));
      expect(api.detachAdminTaxonomyTerm).toHaveBeenCalledWith(12);
    });
  });
});
