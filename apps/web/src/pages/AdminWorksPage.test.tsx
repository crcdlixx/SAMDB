import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import type { Work } from "../api";
import { AdminWorksPage } from "./AdminWorksPage";

vi.mock("../components/AccessEntryForm", () => ({ AccessEntryForm: () => <div data-testid="access-entry-form" /> }));
vi.mock("../components/ImportPanel", () => ({ ImportPanel: () => <div data-testid="import-panel" /> }));
vi.mock("../components/RelationForm", () => ({ RelationForm: () => <div data-testid="relation-form" /> }));
vi.mock("../components/ReleaseForm", () => ({ ReleaseForm: () => <div data-testid="release-form" /> }));
vi.mock("../components/TaxonomyPanel", () => ({ TaxonomyPanel: () => <div data-testid="taxonomy-panel" /> }));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    createAdminAccessEntry: vi.fn(),
    createAdminContributor: vi.fn(),
    createAdminExternalLink: vi.fn(),
    createAdminRelease: vi.fn(),
    createAdminCover: vi.fn(),
    createAdminSource: vi.fn(),
    createAdminWorkRelation: vi.fn(),
    createAdminWork: vi.fn(),
    deleteAdminAccessEntry: vi.fn(),
    deleteAdminRelease: vi.fn(),
    deleteAdminWork: vi.fn(),
    exportAdminWorks: vi.fn(),
    fetchAdminAccessEntries: vi.fn(),
    fetchAdminAuditLogs: vi.fn(),
    fetchAdminContributors: vi.fn(),
    fetchAdminCovers: vi.fn(),
    fetchAdminExternalLinks: vi.fn(),
    fetchAdminReleases: vi.fn(),
    fetchAdminSources: vi.fn(),
    fetchAdminWorks: vi.fn(),
    fetchAdminWork: vi.fn(),
    updateAdminAccessEntry: vi.fn(),
    updateAdminRelease: vi.fn(),
    updateAdminWork: vi.fn()
  };
});

const workOne: Work = {
  id: "work-one",
  title: "First work",
  titleOriginal: null,
  aliases: [],
  year: null,
  language: null,
  summaryShort: "First summary",
  summaryFull: null,
  tags: [],
  sourcePrimary: "source-one",
  recordStatus: "draft",
  visibility: "public"
};

async function clickWorkListItem(title: string) {
  await screen.findByRole("heading", { name: "作品列表" });
  const titleElement = screen.getAllByText(title).find((element) => element.tagName.toLowerCase() === "strong");
  if (!titleElement) throw new Error(`Cannot find work list item: ${title}`);
  await userEvent.click(titleElement);
}

describe("AdminWorksPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAdminAuditLogs).mockResolvedValue({ items: [] });
    vi.mocked(api.fetchAdminContributors).mockResolvedValue({ items: [] });
    vi.mocked(api.fetchAdminCovers).mockResolvedValue({ items: [] });
    vi.mocked(api.fetchAdminExternalLinks).mockResolvedValue({ items: [] });
    vi.mocked(api.fetchAdminSources).mockResolvedValue({ items: [] });
    vi.mocked(api.fetchAdminWorks).mockResolvedValue({ items: [workOne] });
    vi.mocked(api.fetchAdminWork).mockResolvedValue(workOne);
    vi.mocked(api.fetchAdminReleases).mockResolvedValue({ items: [] });
    vi.mocked(api.fetchAdminAccessEntries).mockResolvedValue({ items: [] });
    vi.mocked(api.deleteAdminAccessEntry).mockResolvedValue(undefined);
    vi.mocked(api.deleteAdminRelease).mockResolvedValue(undefined);
    vi.mocked(api.deleteAdminWork).mockResolvedValue(undefined);
    vi.mocked(api.createAdminWorkRelation).mockResolvedValue({ ok: true });
    vi.mocked(api.updateAdminAccessEntry).mockResolvedValue({} as api.AccessEntry);
    vi.mocked(api.updateAdminRelease).mockResolvedValue({} as api.Release);
    vi.mocked(api.updateAdminWork).mockResolvedValue({
      ...workOne,
      title: "Edited work"
    });
  });

  it("renders readable Chinese admin labels", async () => {
    render(<AdminWorksPage />);

    expect(await screen.findByRole("button", { name: "导出作品" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "新建作品" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "作品列表" })).toBeInTheDocument();
    expect(screen.getByText("选择一个作品后维护元数据、制作人员、封面、版本、获取方式、分类与关联。")).toBeInTheDocument();
  });

  it("updates and deletes the selected work from the edit panel", async () => {
    render(<AdminWorksPage />);

    await clickWorkListItem("First work");
    await screen.findByText("当前作品：work-one");

    const editTitleInput = screen.getAllByLabelText("标题 zh-CN")[1];
    await userEvent.clear(editTitleInput);
    await userEvent.type(editTitleInput, "Edited work");
    await userEvent.click(screen.getByRole("button", { name: "保存修改" }));
    await userEvent.click(screen.getByRole("button", { name: "删除作品：work-one" }));

    await waitFor(() => {
      expect(api.updateAdminWork).toHaveBeenCalledWith("work-one", expect.objectContaining({
        id: "work-one",
        title: "Edited work"
      }));
      expect(api.deleteAdminWork).toHaveBeenCalledWith("work-one");
    });
    expect(api.fetchAdminWorks).toHaveBeenCalled();
  });

  it("manages selected release and access entry rows", async () => {
    vi.mocked(api.fetchAdminReleases).mockResolvedValue({
      items: [{
        releaseId: "rel-one",
        parentWorkId: "work-one",
        releaseTitle: "Main Release",
        releaseDate: "2026-06-15",
        edition: null,
        episodeCount: null,
        duration: null,
        fileSize: null,
        resolution: "1080p",
        audioTracks: [],
        subtitleTracks: [],
        qualityNote: null,
        releaseStatus: "published"
      }]
    });
    vi.mocked(api.fetchAdminAccessEntries).mockResolvedValue({
      items: [{
        accessId: "acc-one",
        parentReleaseId: "rel-one",
        accessType: "official_streaming",
        platform: "Example Platform",
        url: "https://example.test/watch",
        availability: "available",
        accessNote: null,
        lastVerified: null,
        mirrorNote: null,
        accessRisk: null,
        checksum: null,
        extractCode: null,
        internalPath: null,
        sensitiveSource: null,
        visibility: "public"
      }]
    });

    render(<AdminWorksPage />);

    await clickWorkListItem("First work");
    await screen.findByText("Main Release");
    await userEvent.click(screen.getByRole("button", { name: "隐藏版本：rel-one" }));
    await userEvent.click(screen.getByRole("button", { name: "隐藏获取方式：acc-one" }));
    await userEvent.click(screen.getByRole("button", { name: "删除获取方式：acc-one" }));
    await userEvent.click(screen.getByRole("button", { name: "删除版本：rel-one" }));

    await waitFor(() => {
      expect(api.updateAdminRelease).toHaveBeenCalledWith("rel-one", expect.objectContaining({
        releaseStatus: "offline"
      }));
      expect(api.updateAdminAccessEntry).toHaveBeenCalledWith("acc-one", expect.objectContaining({
        visibility: "internal"
      }));
      expect(api.deleteAdminAccessEntry).toHaveBeenCalledWith("acc-one");
      expect(api.deleteAdminRelease).toHaveBeenCalledWith("rel-one");
    });
  });

  it("creates a work and then creates selected relations", async () => {
    const createdWork: Work = {
      ...workOne,
      id: "created-work",
      title: "Created work"
    };
    vi.mocked(api.createAdminWork).mockResolvedValue(createdWork);
    vi.mocked(api.fetchAdminWorks).mockResolvedValue({ items: [workOne, createdWork] });

    render(<AdminWorksPage />);

    await screen.findByRole("heading", { name: "作品列表" });
    await userEvent.type(screen.getByLabelText("标题 zh-CN"), "Created work");
    await userEvent.type(screen.getByLabelText("一句话简介 zh-CN"), "Created summary");
    await userEvent.type(screen.getByLabelText("主来源"), "https://example.test/created");
    await userEvent.selectOptions(screen.getByLabelText("关联目标作品"), "work-one");
    await userEvent.selectOptions(screen.getByLabelText("关系类型"), "related");
    await userEvent.click(screen.getByRole("button", { name: "添加到创建关系" }));
    await userEvent.click(screen.getByRole("button", { name: "创建作品" }));

    await waitFor(() => {
      expect(api.createAdminWork).toHaveBeenCalledWith(expect.objectContaining({
        title: "Created work",
        summaryShort: "Created summary"
      }));
      expect(api.createAdminWorkRelation).toHaveBeenCalledWith("created-work", expect.objectContaining({
        targetWorkId: "work-one",
        relationType: "related"
      }));
    });
  });
});
