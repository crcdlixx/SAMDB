import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createWork, getWorkById, listWorks, updateWork } from "../services/works";

describe("works service", () => {
  it("creates, lists, reads, and updates works", () => {
    const db = createMemoryDatabase();

    createWork(db, {
      id: "work-1",
      title: "作品一",
      aliases: ["别名一"],
      summaryShort: "一句话简介",
      sourcePrimary: "https://example.test/source",
      recordStatus: "draft",
      visibility: "public",
      tags: []
    });

    expect(listWorks(db, {}).items).toHaveLength(1);
    expect(getWorkById(db, "work-1")?.title).toBe("作品一");

    updateWork(db, "work-1", {
      title: "作品一 修订",
      summaryShort: "修订简介",
      sourcePrimary: "https://example.test/source-2"
    });

    expect(getWorkById(db, "work-1")?.title).toBe("作品一 修订");
  });
  it("generates uuid ids and stores multilingual fields", () => {
    const db = createMemoryDatabase();

    const created = createWork(db, {
      title: "Default title",
      titleI18n: {
        "zh-CN": "中文标题",
        ja: "日本語タイトル",
        en: "English Title"
      },
      sourceLanguage: "ja",
      aliases: [],
      summaryShort: "Default short summary",
      summaryShortI18n: {
        "zh-CN": "中文一句话",
        ja: "日本語の一文"
      },
      summaryFull: "Default full summary",
      summaryFullI18n: {
        "zh-CN": "中文完整简介",
        ja: "日本語の完全な説明"
      },
      sourcePrimary: "https://example.test/i18n",
      recordStatus: "draft",
      visibility: "public",
      tags: []
    });

    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(created.titleI18n).toEqual(expect.objectContaining({
      "zh-CN": "中文标题",
      ja: "日本語タイトル"
    }));
    expect(created.sourceLanguage).toBe("ja");
    expect(getWorkById(db, created.id)?.summaryShortI18n?.ja).toBe("日本語の一文");
  });
});
