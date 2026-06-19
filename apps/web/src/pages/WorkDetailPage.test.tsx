import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkDetailPage } from "./WorkDetailPage";
import * as api from "../api";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    fetchPublicRelationNetwork: vi.fn(),
    fetchWork: vi.fn(),
    fetchWorkRelations: vi.fn(),
    fetchWorkTaxonomyTerms: vi.fn()
  };
});

describe("WorkDetailPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchWork).mockResolvedValue({
      id: "work-one",
      title: "示例作品",
      titleOriginal: null,
      aliases: [],
      year: "2026",
      language: "zh",
      summaryShort: "一句话简介",
      summaryFull: "完整简介",
      tags: ["tag-one"],
      sourcePrimary: "https://example.test/source",
      recordStatus: "published",
      visibility: "public",
      contributors: [{
        id: 1,
        workId: "work-one",
        name: "Lead Artist",
        role: "artist",
        creditName: "L. Artist",
        note: null,
        visibility: "public",
        createdAt: "2026-06-15T00:00:00.000Z",
        updatedAt: "2026-06-15T00:00:00.000Z"
      }],
      covers: [],
      sources: [{
        id: 2,
        workId: "work-one",
        sourceType: "official",
        url: "https://example.test/source-record",
        title: "官方来源",
        evidenceLevel: "primary",
        note: null,
        visibility: "public",
        lastChecked: null,
        createdAt: "2026-06-15T00:00:00.000Z",
        updatedAt: "2026-06-15T00:00:00.000Z"
      }],
      externalLinks: [{
        id: 3,
        workId: "work-one",
        targetType: "official_site",
        title: "官网",
        url: "https://example.test",
        relationType: "homepage",
        visibility: "public",
        note: null,
        createdAt: "2026-06-15T00:00:00.000Z",
        updatedAt: "2026-06-15T00:00:00.000Z"
      }],
      releases: [{
        releaseId: "rel-one",
        parentWorkId: "work-one",
        releaseTitle: "首发版",
        releaseDate: "2026-06-15",
        edition: null,
        episodeCount: null,
        duration: null,
        fileSize: null,
        resolution: "1080p",
        audioTracks: [],
        subtitleTracks: [],
        qualityNote: "清晰",
        releaseStatus: "published",
        accessEntries: [{
          accessId: "acc-one",
          parentReleaseId: "rel-one",
          accessType: "official_streaming",
          platform: "平台",
          url: "https://example.test/watch",
          availability: "available",
          accessNote: "公开视频",
          visibility: "public"
        }]
      }]
    });
    vi.mocked(api.fetchWorkTaxonomyTerms).mockResolvedValue({
      items: [{
        id: 4,
        work_id: "work-one",
        term_id: "term-one",
        relation_type: "theme",
        confidence: "manual",
        note: null,
        label: "二创",
        slug: "fanwork",
        taxonomy_code: "theme",
        taxonomy_name: "主题"
      }]
    });
    vi.mocked(api.fetchPublicRelationNetwork).mockResolvedValue({
      groups: [{
        group: "related",
        label: "其他关联",
        items: [{
          relationId: 5,
          workId: "target-work",
          title: "关联作品",
          year: null,
          relationType: "related",
          group: "related",
          label: "相关",
          reverse: false,
          note: "有关联"
        }]
      }]
    });
    vi.mocked(api.fetchWorkRelations).mockResolvedValue({
      items: [{
        id: 5,
        source_work_id: "work-one",
        target_work_id: "target-work",
        relation_type: "related",
        direction: "bidirectional",
        note: "有关联",
        target_title: "关联作品"
      }]
    });
  });

  it("renders public detail sections with readable Chinese labels", async () => {
    const onBack = vi.fn();
    render(<WorkDetailPage id="work-one" onBack={onBack} />);

    expect(await screen.findByRole("heading", { name: "示例作品" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "制作人员" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "来源" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "外部链接" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "关联作品" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "版本记录" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "获取方式" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(onBack).toHaveBeenCalled();
  });
});
