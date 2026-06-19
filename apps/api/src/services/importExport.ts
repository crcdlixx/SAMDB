import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import type { SamDb } from "../db";
import { listAccessEntriesForRelease } from "./accessEntries";
import { listRelationsForWork } from "./relations";
import { listReleasesForWork } from "./releases";
import { listTermsForWork } from "./workTaxonomyTerms";
import { createWork, listWorks, type WorkView } from "./works";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function exportWorksToMarkdown(db: SamDb, outputDir = resolve(__dirname, "../../../../data/exports/works")): string[] {
  mkdirSync(outputDir, { recursive: true });
  const files: string[] = [];
  for (const work of listWorks(db, {}).items) {
    const body = YAML.stringify(buildWorkExport(db, work));
    const file = resolve(outputDir, `${work.id}.md`);
    writeFileSync(file, `---\n${body}---\n\n# ${work.title}\n`, "utf8");
    files.push(file);
  }
  return files;
}

function buildWorkExport(db: SamDb, work: WorkView) {
  const releases = listReleasesForWork(db, work.id).map((release) => ({
    ...release,
    accessEntries: listAccessEntriesForRelease(db, release.releaseId)
  }));

  return {
    ...work,
    releases,
    taxonomyTerms: listTermsForWork(db, work.id),
    relations: listRelationsForWork(db, work.id)
  };
}

export function importWorkFromMarkdown(db: SamDb, markdown: string): WorkView {
  const frontmatter = extractFrontmatter(markdown);
  const parsed = YAML.parse(frontmatter) as Record<string, unknown>;

  return createWork(db, {
    id: String(parsed.id ?? ""),
    title: String(parsed.title ?? ""),
    titleOriginal: optionalString(parsed.titleOriginal),
    aliases: asStringArray(parsed.aliases),
    series: optionalString(parsed.series),
    language: optionalString(parsed.language),
    year: optionalString(parsed.year),
    summaryShort: String(parsed.summaryShort ?? ""),
    summaryFull: optionalString(parsed.summaryFull),
    tags: asStringArray(parsed.tags),
    sourcePrimary: String(parsed.sourcePrimary ?? ""),
    recordStatus: String(parsed.recordStatus ?? "draft") as "draft" | "reviewing" | "published" | "frozen" | "offline",
    visibility: String(parsed.visibility ?? "public") as "public" | "restricted" | "internal",
    rightsNote: optionalString(parsed.rightsNote),
    editor: optionalString(parsed.editor),
    reviewer: optionalString(parsed.reviewer)
  });
}

function extractFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error("Markdown does not contain YAML frontmatter");
  return match[1];
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
