import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { attachTermToWork, listTermsForWork } from "../services/workTaxonomyTerms";
import { createTaxonomy, createTerm } from "../services/taxonomies";
import { createWork } from "../services/works";

function seedWorkAndTerm(db: ReturnType<typeof createMemoryDatabase>) {
  createWork(db, {
    id: "work-taxonomy",
    title: "分类测试作品",
    aliases: [],
    tags: [],
    summaryShort: "用于测试分类挂载。",
    sourcePrimary: "https://example.test/source",
    recordStatus: "published",
    visibility: "public"
  });
  createTaxonomy(db, {
    id: "tax-theme",
    code: "theme",
    name: "题材"
  });
  createTerm(db, {
    id: "term-fanwork",
    taxonomyId: "tax-theme",
    label: "二创",
    slug: "fanwork"
  });
}

describe("work taxonomy attachments", () => {
  it("attaches taxonomy terms to works and lists them", () => {
    const db = createMemoryDatabase();
    seedWorkAndTerm(db);

    attachTermToWork(db, {
      workId: "work-taxonomy",
      termId: "term-fanwork",
      relationType: "theme",
      note: "手动挂载"
    });

    const terms = listTermsForWork(db, "work-taxonomy");

    expect(terms).toHaveLength(1);
    expect(terms[0]).toMatchObject({
      term_id: "term-fanwork",
      label: "二创",
      taxonomy_code: "theme",
      relation_type: "theme"
    });
  });
});
