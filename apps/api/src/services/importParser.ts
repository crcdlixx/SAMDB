import YAML from "yaml";
import { recordStatusValues, releaseStatusValues, visibilityValues, workRelationTypeValues } from "@samdb/shared";
import type { WorkInput } from "@samdb/shared";

const KNOWN_WORK_FIELDS = new Set([
  "id", "title", "titleOriginal", "aliases", "series", "language", "year",
  "summaryShort", "summaryFull", "tags", "sourcePrimary", "recordStatus",
  "visibility", "rightsNote", "editor", "reviewer",
  "releases", "taxonomyTerms", "relations", "externalLinks", "sources", "contributors", "covers"
]);

export type ParsedCandidate = {
  ok: true;
  fields: Record<string, unknown>;
  workInput: Partial<WorkInput>;
  extra: Record<string, unknown>;
} | {
  ok: false;
  error: string;
  raw?: string;
};

export function splitMarkdownDocuments(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/\r?\n\r?\n---\r?\n/);
  return parts
    .map((part, index) => (index === 0 ? part : `---\n${part}`).trim())
    .filter(Boolean);
}

export function parseMarkdownBlock(markdown: string): ParsedCandidate {
  try {
    const frontmatter = extractFrontmatter(markdown);
    const parsed = YAML.parse(frontmatter) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Frontmatter must be a YAML object", raw: frontmatter };
    }
    return buildParsedCandidate(parsed);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to parse YAML frontmatter",
      raw: markdown.slice(0, 200)
    };
  }
}

export function parseJsonCandidate(item: Record<string, unknown>): ParsedCandidate {
  return buildParsedCandidate(item);
}

function buildParsedCandidate(parsed: Record<string, unknown>): ParsedCandidate {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!KNOWN_WORK_FIELDS.has(key)) {
      extra[key] = value;
    }
  }

  const workInput: Partial<WorkInput> = {
    id: optionalString(parsed.id) ?? undefined,
    title: optionalString(parsed.title) ?? undefined,
    titleOriginal: optionalString(parsed.titleOriginal),
    aliases: asStringArray(parsed.aliases),
    series: optionalString(parsed.series),
    language: optionalString(parsed.language),
    year: optionalString(parsed.year),
    summaryShort: optionalString(parsed.summaryShort) ?? undefined,
    summaryFull: optionalString(parsed.summaryFull),
    tags: asStringArray(parsed.tags),
    sourcePrimary: optionalString(parsed.sourcePrimary) ?? undefined,
    recordStatus: optionalString(parsed.recordStatus) as WorkInput["recordStatus"] | undefined,
    visibility: optionalString(parsed.visibility) as WorkInput["visibility"] | undefined,
    rightsNote: optionalString(parsed.rightsNote),
    editor: optionalString(parsed.editor),
    reviewer: optionalString(parsed.reviewer)
  };

  return {
    ok: true,
    fields: { ...parsed, extra },
    workInput,
    extra
  };
}

export function extractFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error("Markdown does not contain YAML frontmatter");
  return match[1];
}

export function optionalString(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[\s\-_.,!?;:·、。，！？；：'"「」『』（）()\[\]{}]/g, "");
}

export function isValidRecordStatus(value: string | null | undefined): boolean {
  return value != null && (recordStatusValues as readonly string[]).includes(value);
}

export function isValidVisibility(value: string | null | undefined): boolean {
  return value != null && (visibilityValues as readonly string[]).includes(value);
}

export function isValidReleaseStatus(value: string | null | undefined): boolean {
  return value == null || (releaseStatusValues as readonly string[]).includes(value);
}

export function isValidRelationType(value: string | null | undefined): boolean {
  return value != null && (workRelationTypeValues as readonly string[]).includes(value);
}

export function extractExternalUrls(parsed: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const links = parsed.externalLinks;
  if (Array.isArray(links)) {
    for (const link of links) {
      if (link && typeof link === "object" && "url" in link && link.url) {
        urls.push(String(link.url));
      }
    }
  }
  return urls;
}

export function extractRelations(parsed: Record<string, unknown>): Array<{ targetWorkId: string; relationType?: string }> {
  const relations = parsed.relations;
  if (!Array.isArray(relations)) return [];
  return relations
    .filter((r): r is Record<string, unknown> => r != null && typeof r === "object")
    .map((r) => ({
      targetWorkId: String(r.targetWorkId ?? r.target_work_id ?? ""),
      relationType: optionalString(r.relationType ?? r.relation_type) ?? undefined
    }))
    .filter((r) => r.targetWorkId.length > 0);
}

export function extractAccessEntries(parsed: Record<string, unknown>): Array<{ visibility?: string }> {
  const entries: Array<{ visibility?: string }> = [];
  const releases = parsed.releases;
  if (!Array.isArray(releases)) return entries;
  for (const release of releases) {
    if (!release || typeof release !== "object") continue;
    const accessEntries = (release as Record<string, unknown>).accessEntries;
    if (!Array.isArray(accessEntries)) continue;
    for (const entry of accessEntries) {
      if (entry && typeof entry === "object" && "visibility" in entry) {
        entries.push({ visibility: String(entry.visibility) });
      }
    }
  }
  return entries;
}
