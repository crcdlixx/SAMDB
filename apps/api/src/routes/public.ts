import { Hono } from "hono";
import type { SamDb } from "../db";
import { listPublicAccessEntriesForRelease } from "../services/accessEntries";
import { listPublicContributorsForWork } from "../services/contributors";
import { listPublicCoversForWork } from "../services/covers";
import { listPublicExternalLinksForWork } from "../services/externalLinks";
import { getSeriesDetail, listPublicRelationNetworkForWork, listPublicRelationsForWork, listSeriesSummaries } from "../services/relations";
import { listPublicReleasesForWork } from "../services/releases";
import { listPublicSourcesForWork } from "../services/sources";
import { listTaxonomies, listTermsByTaxonomyCode } from "../services/taxonomies";
import { listTermsForWork } from "../services/workTaxonomyTerms";
import { getWorkById, listPublicWorks } from "../services/works";

export function createPublicApp(db: SamDb): Hono {
  const app = new Hono();

  app.get("/works", (c) => {
    const q = c.req.query("q");
    return c.json(listPublicWorks(db, { q }));
  });

  app.get("/works/:id", (c) => {
    const work = getWorkById(db, c.req.param("id"));
    if (!work || work.visibility !== "public") {
      return c.json({ error: "Not found" }, 404);
    }
    const releases = listPublicReleasesForWork(db, work.id).map((release) => ({
      ...release,
      accessEntries: listPublicAccessEntriesForRelease(db, release.releaseId)
    }));
    return c.json({
      ...work,
      releases,
      contributors: listPublicContributorsForWork(db, work.id),
      covers: listPublicCoversForWork(db, work.id),
      sources: listPublicSourcesForWork(db, work.id),
      externalLinks: listPublicExternalLinksForWork(db, work.id)
    });
  });

  app.get("/search", (c) => {
    const q = c.req.query("q") ?? "";
    return c.json(listPublicWorks(db, { q }));
  });

  app.get("/works/:id/relations", (c) => c.json({ items: listPublicRelationsForWork(db, c.req.param("id")) }));
  app.get("/works/:id/relation-network", (c) => c.json(listPublicRelationNetworkForWork(db, c.req.param("id"))));
  app.get("/series", (c) => c.json(listSeriesSummaries(db)));
  app.get("/series/:name", (c) => {
    const detail = getSeriesDetail(db, c.req.param("name"));
    if (!detail) return c.json({ error: "Not found" }, 404);
    return c.json(detail);
  });
  app.get("/works/:id/taxonomy-terms", (c) => c.json({ items: listTermsForWork(db, c.req.param("id")) }));
  app.get("/taxonomies", (c) => c.json({ items: listTaxonomies(db) }));
  app.get("/taxonomies/:code", (c) => c.json({ items: listTermsByTaxonomyCode(db, c.req.param("code")) }));

  return app;
}
