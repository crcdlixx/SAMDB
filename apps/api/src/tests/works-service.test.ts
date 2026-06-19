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
});
