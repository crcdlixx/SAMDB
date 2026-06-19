# SAMDB Local MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, front-end/back-end separated SAMDB MVP with SQLite persistence, public work browsing, admin CRUD, taxonomy attachments, work relations, and Markdown/YAML import-export.

**Architecture:** The app is a TypeScript monorepo with a Vite React front end, a Hono Node API, shared Zod schemas, and a SQLite data layer. The API is the only component that talks to SQLite and is responsible for public-field filtering.

**Tech Stack:** React, Vite, TypeScript, Hono, Node `node:sqlite`, Zod, Tailwind-style plain CSS, Vitest, tsx.

---

## File Structure

Create this structure under `D:/NewStarProject/SAMDB`:

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
.gitignore
.env.example

apps/
  api/
    package.json
    tsconfig.json
    src/
      index.ts
      db.ts
      schema.sql
      seed.ts
      routes/
        public.ts
        admin.ts
      services/
        works.ts
        taxonomies.ts
        relations.ts
        importExport.ts
      tests/
        public-filter.test.ts
        works-service.test.ts

  web/
    package.json
    index.html
    tsconfig.json
    vite.config.ts
    src/
      main.tsx
      App.tsx
      api.ts
      styles.css
      components/
        AppShell.tsx
        WorkCard.tsx
        WorkForm.tsx
        RelationList.tsx
      pages/
        WorksPage.tsx
        WorkDetailPage.tsx
        AdminWorksPage.tsx
        AdminWorkEditPage.tsx

packages/
  shared/
    package.json
    tsconfig.json
    src/
      index.ts
      enums.ts
      schemas.ts
      types.ts
      visibility.ts
      tests/
        visibility.test.ts

data/
  assets/
    covers/
  imports/
  exports/
```

Responsibilities:

- `packages/shared`: shared enums, Zod schemas, TypeScript types, and public-field filtering helpers.
- `apps/api/src/db.ts`: SQLite connection, schema initialization, and test database creation.
- `apps/api/src/services`: database operations grouped by domain.
- `apps/api/src/routes`: HTTP API routes.
- `apps/web/src/api.ts`: browser-side API client.
- `apps/web/src/pages`: route-level screens.
- `apps/web/src/components`: reusable UI components.

## Task 1: Initialize Monorepo Tooling

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create root package metadata**

Create `package.json`:

```json
{
  "name": "samdb",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "pnpm --parallel --filter @samdb/api --filter @samdb/web dev",
    "dev:api": "pnpm --filter @samdb/api dev",
    "dev:web": "pnpm --filter @samdb/web dev",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "@types/node": "^20.14.11",
    "tsx": "^4.16.2",
    "typescript": "^5.5.3",
    "vitest": "^1.6.0"
  },
  "packageManager": "pnpm@9.4.0"
}
```

- [ ] **Step 2: Create workspace config**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create shared TypeScript config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@samdb/shared": ["packages/shared/src/index.ts"],
      "@samdb/shared/*": ["packages/shared/src/*"]
    }
  }
}
```

- [ ] **Step 4: Create ignore and environment examples**

Create `.gitignore`:

```gitignore
node_modules/
dist/
.vite/
.env
data/*.sqlite
data/*.sqlite-shm
data/*.sqlite-wal
data/exports/
```

Create `.env.example`:

```env
SAMDB_DATABASE_PATH=../../data/samdb.sqlite
SAMDB_API_PORT=8787
VITE_API_BASE_URL=http://localhost:8787
```

- [ ] **Step 5: Install dependencies**

Run:

```powershell
pnpm install
```

Expected: lockfile is created and no install errors occur.

## Task 2: Create Shared Types and Field Filtering

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/enums.ts`
- Create: `packages/shared/src/schemas.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/visibility.ts`
- Create: `packages/shared/src/tests/visibility.test.ts`

- [ ] **Step 1: Create shared package config**

Create `packages/shared/package.json`:

```json
{
  "name": "@samdb/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

Create `packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Define enums**

Create `packages/shared/src/enums.ts`:

```ts
export const visibilityValues = ["public", "restricted", "internal"] as const;
export type Visibility = (typeof visibilityValues)[number];

export const recordStatusValues = ["draft", "reviewing", "published", "frozen", "offline"] as const;
export type RecordStatus = (typeof recordStatusValues)[number];

export const releaseStatusValues = ["draft", "published", "available", "unverified", "offline"] as const;
export type ReleaseStatus = (typeof releaseStatusValues)[number];

export const workRelationTypeValues = [
  "same_series",
  "sequel",
  "prequel",
  "remake",
  "remaster",
  "adaptation_of",
  "adapted_to",
  "spin_off",
  "compilation_of",
  "included_in",
  "alternate_version",
  "translation_of",
  "subtitle_version",
  "fanwork_of",
  "inspired_by",
  "references",
  "related"
] as const;
export type WorkRelationType = (typeof workRelationTypeValues)[number];
```

- [ ] **Step 3: Define schemas and types**

Create `packages/shared/src/schemas.ts`:

```ts
import { z } from "zod";
import { recordStatusValues, releaseStatusValues, visibilityValues, workRelationTypeValues } from "./enums";

export const workSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  titleOriginal: z.string().nullable().optional(),
  aliases: z.array(z.string()).default([]),
  series: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  year: z.string().nullable().optional(),
  summaryShort: z.string().min(1),
  summaryFull: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  sourcePrimary: z.string().min(1),
  recordStatus: z.enum(recordStatusValues).default("draft"),
  visibility: z.enum(visibilityValues).default("public"),
  rightsNote: z.string().nullable().optional(),
  editor: z.string().nullable().optional(),
  reviewer: z.string().nullable().optional()
});

export const releaseSchema = z.object({
  releaseId: z.string().min(1),
  parentWorkId: z.string().min(1),
  releaseTitle: z.string().nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  edition: z.string().nullable().optional(),
  episodeCount: z.number().int().nullable().optional(),
  duration: z.string().nullable().optional(),
  fileSize: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
  audioTracks: z.array(z.record(z.unknown())).default([]),
  subtitleTracks: z.array(z.record(z.unknown())).default([]),
  qualityNote: z.string().nullable().optional(),
  releaseStatus: z.enum(releaseStatusValues).default("draft")
});

export const accessEntrySchema = z.object({
  accessId: z.string().min(1),
  parentReleaseId: z.string().min(1),
  accessType: z.string().min(1),
  platform: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  availability: z.string().nullable().optional(),
  accessNote: z.string().nullable().optional(),
  lastVerified: z.string().nullable().optional(),
  mirrorNote: z.string().nullable().optional(),
  accessRisk: z.string().nullable().optional(),
  checksum: z.string().nullable().optional(),
  extractCode: z.string().nullable().optional(),
  internalPath: z.string().nullable().optional(),
  sensitiveSource: z.string().nullable().optional(),
  visibility: z.enum(visibilityValues).default("restricted")
});

export const workRelationSchema = z.object({
  sourceWorkId: z.string().min(1),
  targetWorkId: z.string().min(1),
  relationType: z.enum(workRelationTypeValues),
  direction: z.enum(["directed", "bidirectional"]).default("directed"),
  note: z.string().nullable().optional(),
  confidence: z.string().default("manual"),
  visibility: z.enum(visibilityValues).default("public")
});
```

Create `packages/shared/src/types.ts`:

```ts
import type { z } from "zod";
import type { accessEntrySchema, releaseSchema, workRelationSchema, workSchema } from "./schemas";

export type WorkInput = z.infer<typeof workSchema>;
export type ReleaseInput = z.infer<typeof releaseSchema>;
export type AccessEntryInput = z.infer<typeof accessEntrySchema>;
export type WorkRelationInput = z.infer<typeof workRelationSchema>;
```

- [ ] **Step 4: Implement public filtering**

Create `packages/shared/src/visibility.ts`:

```ts
const internalAccessFields = new Set([
  "mirrorNote",
  "accessRisk",
  "checksum",
  "extractCode",
  "internalPath",
  "sensitiveSource",
  "mirror_note",
  "access_risk",
  "extract_code",
  "internal_path",
  "sensitive_source"
]);

export function filterPublicAccessEntry<T extends Record<string, unknown>>(entry: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(entry).filter(([key]) => !internalAccessFields.has(key))
  ) as Partial<T>;
}

export function filterPublicList<T extends Record<string, unknown>>(items: T[]): Array<Partial<T>> {
  return items.map((item) => filterPublicAccessEntry(item));
}
```

Create `packages/shared/src/index.ts`:

```ts
export * from "./enums";
export * from "./schemas";
export * from "./types";
export * from "./visibility";
```

- [ ] **Step 5: Test field filtering**

Create `packages/shared/src/tests/visibility.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterPublicAccessEntry } from "../visibility";

describe("filterPublicAccessEntry", () => {
  it("removes restricted and internal access fields", () => {
    const filtered = filterPublicAccessEntry({
      accessId: "acc-1",
      accessType: "official_streaming",
      platform: "Example",
      url: "https://example.test",
      mirrorNote: "mirror detail",
      accessRisk: "risk detail",
      checksum: "abc",
      extractCode: "1234",
      internalPath: "D:/secret",
      sensitiveSource: "private"
    });

    expect(filtered).toEqual({
      accessId: "acc-1",
      accessType: "official_streaming",
      platform: "Example",
      url: "https://example.test"
    });
  });
});
```

- [ ] **Step 6: Run shared tests**

Run:

```powershell
pnpm --filter @samdb/shared test
pnpm --filter @samdb/shared typecheck
```

Expected: tests pass and TypeScript reports no errors.

## Task 3: Implement SQLite Schema and Database Helpers

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/schema.sql`
- Create: `apps/api/src/db.ts`
- Create: `apps/api/src/seed.ts`
- Create: `apps/api/src/tests/works-service.test.ts`

- [ ] **Step 1: Create API package config**

Create `apps/api/package.json`:

```json
{
  "name": "@samdb/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "seed": "tsx src/seed.ts"
  },
  "dependencies": {
    "@hono/node-server": "^1.12.0",
    "@samdb/shared": "workspace:*",
    "hono": "^4.4.7",
    "nanoid": "^5.0.7",
    "yaml": "^2.4.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

Create `apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "moduleResolution": "Bundler"
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Create SQLite schema**

Create `apps/api/src/schema.sql` with the SQL from the design spec, plus indexes:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_original TEXT,
  aliases_json TEXT,
  series TEXT,
  language TEXT,
  year TEXT,
  summary_short TEXT NOT NULL,
  summary_full TEXT,
  tags_json TEXT,
  source_primary TEXT NOT NULL,
  record_status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'public',
  rights_note TEXT,
  editor TEXT,
  reviewer TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS releases (
  release_id TEXT PRIMARY KEY,
  parent_work_id TEXT NOT NULL,
  release_title TEXT,
  release_date TEXT,
  edition TEXT,
  episode_count INTEGER,
  duration TEXT,
  file_size TEXT,
  resolution TEXT,
  audio_tracks_json TEXT,
  subtitle_tracks_json TEXT,
  cover_variant_id TEXT,
  quality_note TEXT,
  release_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS access_entries (
  access_id TEXT PRIMARY KEY,
  parent_release_id TEXT NOT NULL,
  access_type TEXT NOT NULL,
  platform TEXT,
  url TEXT,
  availability TEXT,
  access_note TEXT,
  last_verified TEXT,
  mirror_note TEXT,
  access_risk TEXT,
  checksum TEXT,
  extract_code TEXT,
  internal_path TEXT,
  sensitive_source TEXT,
  visibility TEXT NOT NULL DEFAULT 'restricted',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_release_id) REFERENCES releases(release_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  credit_name TEXT,
  note TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS covers (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  release_id TEXT,
  url TEXT NOT NULL,
  source TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  process_note TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
  FOREIGN KEY (release_id) REFERENCES releases(release_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS taxonomies (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS taxonomy_terms (
  id TEXT PRIMARY KEY,
  taxonomy_id TEXT NOT NULL,
  parent_id TEXT,
  label TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (taxonomy_id) REFERENCES taxonomies(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES taxonomy_terms(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS work_taxonomy_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL,
  term_id TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'tag',
  confidence TEXT NOT NULL DEFAULT 'manual',
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
  FOREIGN KEY (term_id) REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  UNIQUE(work_id, term_id, relation_type)
);

CREATE TABLE IF NOT EXISTS work_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_work_id TEXT NOT NULL,
  target_work_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'directed',
  note TEXT,
  confidence TEXT NOT NULL DEFAULT 'manual',
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_work_id) REFERENCES works(id) ON DELETE CASCADE,
  FOREIGN KEY (target_work_id) REFERENCES works(id) ON DELETE CASCADE,
  CHECK (source_work_id != target_work_id),
  UNIQUE(source_work_id, target_work_id, relation_type)
);

CREATE TABLE IF NOT EXISTS external_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  title TEXT,
  url TEXT,
  relation_type TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL,
  source_type TEXT,
  url TEXT,
  title TEXT,
  evidence_level TEXT,
  note TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  last_checked TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_works_title ON works(title);
CREATE INDEX IF NOT EXISTS idx_releases_parent_work ON releases(parent_work_id);
CREATE INDEX IF NOT EXISTS idx_access_parent_release ON access_entries(parent_release_id);
CREATE INDEX IF NOT EXISTS idx_terms_taxonomy ON taxonomy_terms(taxonomy_id);
CREATE INDEX IF NOT EXISTS idx_relations_source ON work_relations(source_work_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON work_relations(target_work_id);
```

- [ ] **Step 3: Create DB helper**

Create `apps/api/src/db.ts`:

```ts
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type SamDb = DatabaseSync;

export function createDatabase(path = resolve(__dirname, "../../../../data/samdb.sqlite")): SamDb {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

export function initializeDatabase(db: SamDb): void {
  const schema = readFileSync(resolve(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
}

export function createMemoryDatabase(): SamDb {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  initializeDatabase(db);
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}
```

- [ ] **Step 4: Create seed script**

Create `apps/api/src/seed.ts`:

```ts
import { createDatabase, initializeDatabase, nowIso } from "./db";

const db = createDatabase();
initializeDatabase(db);

const now = nowIso();

db.prepare(`
  INSERT OR IGNORE INTO works (
    id, title, aliases_json, summary_short, source_primary,
    record_status, visibility, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  "sample-work",
  "示例作品",
  JSON.stringify(["Sample Work"]),
  "用于验证 SAMDB 本地版的示例作品。",
  "https://example.test/source",
  "published",
  "public",
  now,
  now
);

db.prepare(`
  INSERT OR IGNORE INTO taxonomies (
    id, code, name, description, is_system, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`).run("tax-work-type", "work_type", "作品类型", "作品类型分类体系", 1, now, now);

console.log("Seed complete");
```

- [ ] **Step 5: Install dependencies and run typecheck**

Run:

```powershell
pnpm install
pnpm --filter @samdb/api typecheck
```

Expected: TypeScript reports no errors.

## Task 4: Implement Work Service and Tests

**Files:**
- Create: `apps/api/src/services/works.ts`
- Modify: `apps/api/src/tests/works-service.test.ts`

- [ ] **Step 1: Write service tests**

Create `apps/api/src/tests/works-service.test.ts`:

```ts
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
```

- [ ] **Step 2: Implement work service**

Create `apps/api/src/services/works.ts`:

```ts
import { workSchema, type WorkInput } from "@samdb/shared";
import type { SamDb } from "../db";
import { nowIso } from "../db";

type WorkRow = {
  id: string;
  title: string;
  title_original: string | null;
  aliases_json: string | null;
  series: string | null;
  language: string | null;
  year: string | null;
  summary_short: string;
  summary_full: string | null;
  tags_json: string | null;
  source_primary: string;
  record_status: string;
  visibility: string;
  rights_note: string | null;
  editor: string | null;
  reviewer: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkView = {
  id: string;
  title: string;
  titleOriginal: string | null;
  aliases: string[];
  series: string | null;
  language: string | null;
  year: string | null;
  summaryShort: string;
  summaryFull: string | null;
  tags: string[];
  sourcePrimary: string;
  recordStatus: string;
  visibility: string;
  rightsNote: string | null;
  editor: string | null;
  reviewer: string | null;
  createdAt: string;
  updatedAt: string;
};

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function toWorkView(row: WorkRow): WorkView {
  return {
    id: row.id,
    title: row.title,
    titleOriginal: row.title_original,
    aliases: parseJsonArray(row.aliases_json),
    series: row.series,
    language: row.language,
    year: row.year,
    summaryShort: row.summary_short,
    summaryFull: row.summary_full,
    tags: parseJsonArray(row.tags_json),
    sourcePrimary: row.source_primary,
    recordStatus: row.record_status,
    visibility: row.visibility,
    rightsNote: row.rights_note,
    editor: row.editor,
    reviewer: row.reviewer,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createWork(db: SamDb, input: WorkInput): WorkView {
  const parsed = workSchema.parse(input);
  const now = nowIso();

  db.prepare(`
    INSERT INTO works (
      id, title, title_original, aliases_json, series, language, year,
      summary_short, summary_full, tags_json, source_primary, record_status,
      visibility, rights_note, editor, reviewer, created_at, updated_at
    ) VALUES (
      @id, @title, @titleOriginal, @aliasesJson, @series, @language, @year,
      @summaryShort, @summaryFull, @tagsJson, @sourcePrimary, @recordStatus,
      @visibility, @rightsNote, @editor, @reviewer, @createdAt, @updatedAt
    )
  `).run({
    id: parsed.id,
    title: parsed.title,
    titleOriginal: parsed.titleOriginal ?? null,
    aliasesJson: JSON.stringify(parsed.aliases),
    series: parsed.series ?? null,
    language: parsed.language ?? null,
    year: parsed.year ?? null,
    summaryShort: parsed.summaryShort,
    summaryFull: parsed.summaryFull ?? null,
    tagsJson: JSON.stringify(parsed.tags),
    sourcePrimary: parsed.sourcePrimary,
    recordStatus: parsed.recordStatus,
    visibility: parsed.visibility,
    rightsNote: parsed.rightsNote ?? null,
    editor: parsed.editor ?? null,
    reviewer: parsed.reviewer ?? null,
    createdAt: now,
    updatedAt: now
  });

  const created = getWorkById(db, parsed.id);
  if (!created) throw new Error("Work was not created");
  return created;
}

export function listWorks(db: SamDb, options: { q?: string }): { items: WorkView[] } {
  const q = options.q?.trim();
  const rows = q
    ? db.prepare(`
        SELECT * FROM works
        WHERE title LIKE @like OR aliases_json LIKE @like
        ORDER BY updated_at DESC
      `).all({ like: `%${q}%` }) as WorkRow[]
    : db.prepare("SELECT * FROM works ORDER BY updated_at DESC").all() as WorkRow[];

  return { items: rows.map(toWorkView) };
}

export function getWorkById(db: SamDb, id: string): WorkView | null {
  const row = db.prepare("SELECT * FROM works WHERE id = ?").get(id) as WorkRow | undefined;
  return row ? toWorkView(row) : null;
}

export function updateWork(db: SamDb, id: string, input: Partial<WorkInput>): WorkView {
  const existing = getWorkById(db, id);
  if (!existing) throw new Error(`Work not found: ${id}`);

  const merged = workSchema.parse({
    id,
    title: input.title ?? existing.title,
    titleOriginal: input.titleOriginal ?? existing.titleOriginal,
    aliases: input.aliases ?? existing.aliases,
    series: input.series ?? existing.series,
    language: input.language ?? existing.language,
    year: input.year ?? existing.year,
    summaryShort: input.summaryShort ?? existing.summaryShort,
    summaryFull: input.summaryFull ?? existing.summaryFull,
    tags: input.tags ?? existing.tags,
    sourcePrimary: input.sourcePrimary ?? existing.sourcePrimary,
    recordStatus: input.recordStatus ?? existing.recordStatus,
    visibility: input.visibility ?? existing.visibility,
    rightsNote: input.rightsNote ?? existing.rightsNote,
    editor: input.editor ?? existing.editor,
    reviewer: input.reviewer ?? existing.reviewer
  });

  db.prepare(`
    UPDATE works SET
      title = @title,
      title_original = @titleOriginal,
      aliases_json = @aliasesJson,
      series = @series,
      language = @language,
      year = @year,
      summary_short = @summaryShort,
      summary_full = @summaryFull,
      tags_json = @tagsJson,
      source_primary = @sourcePrimary,
      record_status = @recordStatus,
      visibility = @visibility,
      rights_note = @rightsNote,
      editor = @editor,
      reviewer = @reviewer,
      updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id,
    title: merged.title,
    titleOriginal: merged.titleOriginal ?? null,
    aliasesJson: JSON.stringify(merged.aliases),
    series: merged.series ?? null,
    language: merged.language ?? null,
    year: merged.year ?? null,
    summaryShort: merged.summaryShort,
    summaryFull: merged.summaryFull ?? null,
    tagsJson: JSON.stringify(merged.tags),
    sourcePrimary: merged.sourcePrimary,
    recordStatus: merged.recordStatus,
    visibility: merged.visibility,
    rightsNote: merged.rightsNote ?? null,
    editor: merged.editor ?? null,
    reviewer: merged.reviewer ?? null,
    updatedAt: nowIso()
  });

  const updated = getWorkById(db, id);
  if (!updated) throw new Error("Work disappeared after update");
  return updated;
}

export function deleteWork(db: SamDb, id: string): void {
  db.prepare("DELETE FROM works WHERE id = ?").run(id);
}
```

- [ ] **Step 3: Run service tests**

Run:

```powershell
pnpm --filter @samdb/api test -- works-service
pnpm --filter @samdb/api typecheck
```

Expected: work service test passes and TypeScript reports no errors.

## Task 5: Implement API Routes

**Files:**
- Create: `apps/api/src/routes/public.ts`
- Create: `apps/api/src/routes/admin.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/tests/public-filter.test.ts`

- [ ] **Step 1: Add public API tests**

Create `apps/api/src/tests/public-filter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createWork } from "../services/works";
import { createPublicApp } from "../routes/public";

describe("public routes", () => {
  it("serves public works", async () => {
    const db = createMemoryDatabase();
    createWork(db, {
      id: "public-work",
      title: "公开作品",
      aliases: [],
      tags: [],
      summaryShort: "公开简介",
      sourcePrimary: "https://example.test/source",
      recordStatus: "published",
      visibility: "public"
    });

    const app = createPublicApp(db);
    const response = await app.request("/works");
    const body = await response.json() as { items: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.items[0]?.id).toBe("public-work");
  });
});
```

- [ ] **Step 2: Create public routes**

Create `apps/api/src/routes/public.ts`:

```ts
import { Hono } from "hono";
import type { SamDb } from "../db";
import { getWorkById, listWorks } from "../services/works";

export function createPublicApp(db: SamDb): Hono {
  const app = new Hono();

  app.get("/works", (c) => {
    const q = c.req.query("q");
    return c.json(listWorks(db, { q }));
  });

  app.get("/works/:id", (c) => {
    const work = getWorkById(db, c.req.param("id"));
    if (!work || work.visibility !== "public") {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json(work);
  });

  app.get("/search", (c) => {
    const q = c.req.query("q") ?? "";
    return c.json(listWorks(db, { q }));
  });

  return app;
}
```

- [ ] **Step 3: Create admin routes**

Create `apps/api/src/routes/admin.ts`:

```ts
import { Hono } from "hono";
import type { SamDb } from "../db";
import { createWork, deleteWork, getWorkById, listWorks, updateWork } from "../services/works";

export function createAdminApp(db: SamDb): Hono {
  const app = new Hono();

  app.get("/works", (c) => c.json(listWorks(db, { q: c.req.query("q") })));

  app.post("/works", async (c) => {
    const body = await c.req.json();
    const work = createWork(db, body);
    return c.json(work, 201);
  });

  app.get("/works/:id", (c) => {
    const work = getWorkById(db, c.req.param("id"));
    if (!work) return c.json({ error: "Not found" }, 404);
    return c.json(work);
  });

  app.patch("/works/:id", async (c) => {
    const work = updateWork(db, c.req.param("id"), await c.req.json());
    return c.json(work);
  });

  app.delete("/works/:id", (c) => {
    deleteWork(db, c.req.param("id"));
    return c.body(null, 204);
  });

  return app;
}
```

- [ ] **Step 4: Create API server entry**

Create `apps/api/src/index.ts`:

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDatabase, initializeDatabase } from "./db";
import { createAdminApp } from "./routes/admin";
import { createPublicApp } from "./routes/public";

const db = createDatabase(process.env.SAMDB_DATABASE_PATH);
initializeDatabase(db);

const app = new Hono();
app.use("*", cors());
app.route("/api/public", createPublicApp(db));
app.route("/api/admin", createAdminApp(db));

app.get("/health", (c) => c.json({ ok: true }));

const port = Number(process.env.SAMDB_API_PORT ?? 8787);
serve({ fetch: app.fetch, port });

console.log(`SAMDB API listening on http://localhost:${port}`);
```

- [ ] **Step 5: Run route tests and seed**

Run:

```powershell
pnpm --filter @samdb/api test -- public-filter
pnpm --filter @samdb/api seed
```

Expected: route test passes and seed prints `Seed complete`.

## Task 6: Create Web App Shell and Public Work Pages

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/api.ts`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/src/components/AppShell.tsx`
- Create: `apps/web/src/components/WorkCard.tsx`
- Create: `apps/web/src/pages/WorksPage.tsx`
- Create: `apps/web/src/pages/WorkDetailPage.tsx`

- [ ] **Step 1: Create web package config**

Create `apps/web/package.json`:

```json
{
  "name": "@samdb/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@samdb/shared": "workspace:*",
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.5.3",
    "vitest": "^1.6.0"
  }
}
```

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `apps/web/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
});
```

Create `apps/web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SAMDB</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create API client**

Create `apps/web/src/api.ts`:

```ts
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

export type Work = {
  id: string;
  title: string;
  titleOriginal: string | null;
  aliases: string[];
  year: string | null;
  language: string | null;
  summaryShort: string;
  summaryFull: string | null;
  tags: string[];
  sourcePrimary: string;
  recordStatus: string;
  visibility: string;
};

export async function fetchWorks(q = ""): Promise<{ items: Work[] }> {
  const url = new URL(`${baseUrl}/api/public/works`);
  if (q) url.searchParams.set("q", q);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch works");
  return response.json() as Promise<{ items: Work[] }>;
}

export async function fetchWork(id: string): Promise<Work> {
  const response = await fetch(`${baseUrl}/api/public/works/${id}`);
  if (!response.ok) throw new Error("Failed to fetch work");
  return response.json() as Promise<Work>;
}
```

- [ ] **Step 3: Create visual shell and styles**

Create `apps/web/src/styles.css`:

```css
:root {
  color: #222;
  background: #f7f7f4;
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
}

body {
  margin: 0;
}

button,
input,
textarea,
select {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-bottom: 1px solid #d8d8d2;
  background: #ffffff;
}

.brand {
  font-weight: 700;
}

.nav {
  display: flex;
  gap: 12px;
}

.nav button {
  border: 1px solid #c8c8c2;
  background: #fff;
  border-radius: 6px;
  padding: 7px 10px;
  cursor: pointer;
}

.content {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px;
}

.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}

.toolbar input {
  width: min(520px, 100%);
  padding: 9px 10px;
  border: 1px solid #bfc0bb;
  border-radius: 6px;
}

.work-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 14px;
}

.work-card {
  display: grid;
  gap: 8px;
  border: 1px solid #d5d5ce;
  background: #fff;
  border-radius: 8px;
  padding: 14px;
  cursor: pointer;
}

.muted {
  color: #666b70;
  font-size: 0.92rem;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  border: 1px solid #d3d7d0;
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 0.8rem;
  background: #f5f7f1;
}
```

Create `apps/web/src/components/AppShell.tsx`:

```tsx
type AppShellProps = {
  children: React.ReactNode;
  onNavigate: (page: "works" | "admin") => void;
};

export function AppShell({ children, onNavigate }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">SAMDB</div>
        <nav className="nav">
          <button onClick={() => onNavigate("works")}>作品</button>
          <button onClick={() => onNavigate("admin")}>后台</button>
        </nav>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
```

Create `apps/web/src/components/WorkCard.tsx`:

```tsx
import type { Work } from "../api";

type WorkCardProps = {
  work: Work;
  onOpen: (id: string) => void;
};

export function WorkCard({ work, onOpen }: WorkCardProps) {
  return (
    <article className="work-card" onClick={() => onOpen(work.id)}>
      <strong>{work.title}</strong>
      {work.titleOriginal ? <span className="muted">{work.titleOriginal}</span> : null}
      <p>{work.summaryShort}</p>
      <div className="tag-row">
        {work.year ? <span className="tag">{work.year}</span> : null}
        {work.language ? <span className="tag">{work.language}</span> : null}
        {work.tags.slice(0, 3).map((tag) => (
          <span className="tag" key={tag}>{tag}</span>
        ))}
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Create public pages**

Create `apps/web/src/pages/WorksPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { fetchWorks, type Work } from "../api";
import { WorkCard } from "../components/WorkCard";

type WorksPageProps = {
  onOpenWork: (id: string) => void;
};

export function WorksPage({ onOpenWork }: WorksPageProps) {
  const [query, setQuery] = useState("");
  const [works, setWorks] = useState<Work[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorks(query).then((result) => {
      setWorks(result.items);
      setError(null);
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "加载失败");
    });
  }, [query]);

  return (
    <section>
      <div className="toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索标题、别名"
        />
      </div>
      {error ? <p>{error}</p> : null}
      <div className="work-grid">
        {works.map((work) => (
          <WorkCard key={work.id} work={work} onOpen={onOpenWork} />
        ))}
      </div>
    </section>
  );
}
```

Create `apps/web/src/pages/WorkDetailPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { fetchWork, type Work } from "../api";

type WorkDetailPageProps = {
  id: string;
  onBack: () => void;
};

export function WorkDetailPage({ id, onBack }: WorkDetailPageProps) {
  const [work, setWork] = useState<Work | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWork(id).then((result) => {
      setWork(result);
      setError(null);
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "加载失败");
    });
  }, [id]);

  if (error) return <p>{error}</p>;
  if (!work) return <p>加载中...</p>;

  return (
    <article>
      <button onClick={onBack}>返回</button>
      <h1>{work.title}</h1>
      {work.titleOriginal ? <p className="muted">{work.titleOriginal}</p> : null}
      <p>{work.summaryShort}</p>
      {work.summaryFull ? <p>{work.summaryFull}</p> : null}
      <div className="tag-row">
        {work.tags.map((tag) => (
          <span className="tag" key={tag}>{tag}</span>
        ))}
      </div>
      <h2>来源</h2>
      <p>{work.sourcePrimary}</p>
    </article>
  );
}
```

- [ ] **Step 5: Create app entry**

Create `apps/web/src/App.tsx`:

```tsx
import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { WorksPage } from "./pages/WorksPage";
import { WorkDetailPage } from "./pages/WorkDetailPage";

type PageState =
  | { name: "works" }
  | { name: "workDetail"; id: string }
  | { name: "admin" };

export function App() {
  const [page, setPage] = useState<PageState>({ name: "works" });

  return (
    <AppShell onNavigate={(name) => setPage({ name })}>
      {page.name === "works" ? (
        <WorksPage onOpenWork={(id) => setPage({ name: "workDetail", id })} />
      ) : null}
      {page.name === "workDetail" ? (
        <WorkDetailPage id={page.id} onBack={() => setPage({ name: "works" })} />
      ) : null}
      {page.name === "admin" ? (
        <p>后台将在下一任务接入。</p>
      ) : null}
    </AppShell>
  );
}
```

Create `apps/web/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Run web typecheck**

Run:

```powershell
pnpm --filter @samdb/web typecheck
```

Expected: TypeScript reports no errors.

## Task 7: Add Admin Work Editing

**Files:**
- Modify: `apps/web/src/api.ts`
- Create: `apps/web/src/components/WorkForm.tsx`
- Create: `apps/web/src/pages/AdminWorksPage.tsx`
- Create: `apps/web/src/pages/AdminWorkEditPage.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add admin API client functions**

Modify `apps/web/src/api.ts` to add:

```ts
export type WorkPayload = {
  id: string;
  title: string;
  aliases: string[];
  tags: string[];
  summaryShort: string;
  summaryFull?: string | null;
  sourcePrimary: string;
  recordStatus: string;
  visibility: string;
};

export async function createAdminWork(payload: WorkPayload): Promise<Work> {
  const response = await fetch(`${baseUrl}/api/admin/works`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create work");
  return response.json() as Promise<Work>;
}

export async function updateAdminWork(id: string, payload: Partial<WorkPayload>): Promise<Work> {
  const response = await fetch(`${baseUrl}/api/admin/works/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to update work");
  return response.json() as Promise<Work>;
}
```

- [ ] **Step 2: Create work form**

Create `apps/web/src/components/WorkForm.tsx`:

```tsx
import { useState } from "react";
import type { Work, WorkPayload } from "../api";

type WorkFormProps = {
  initial?: Work;
  onSubmit: (payload: WorkPayload) => Promise<void>;
};

export function WorkForm({ initial, onSubmit }: WorkFormProps) {
  const [payload, setPayload] = useState<WorkPayload>({
    id: initial?.id ?? "",
    title: initial?.title ?? "",
    aliases: initial?.aliases ?? [],
    tags: initial?.tags ?? [],
    summaryShort: initial?.summaryShort ?? "",
    summaryFull: initial?.summaryFull ?? "",
    sourcePrimary: initial?.sourcePrimary ?? "",
    recordStatus: initial?.recordStatus ?? "draft",
    visibility: initial?.visibility ?? "public"
  });
  const [message, setMessage] = useState("");

  function setField<K extends keyof WorkPayload>(key: K, value: WorkPayload[K]) {
    setPayload((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="work-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(payload).then(() => setMessage("已保存")).catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "保存失败");
        });
      }}
    >
      <label>ID <input value={payload.id} onChange={(event) => setField("id", event.target.value)} disabled={Boolean(initial)} /></label>
      <label>标题 <input value={payload.title} onChange={(event) => setField("title", event.target.value)} /></label>
      <label>一句话简介 <textarea value={payload.summaryShort} onChange={(event) => setField("summaryShort", event.target.value)} /></label>
      <label>完整简介 <textarea value={payload.summaryFull ?? ""} onChange={(event) => setField("summaryFull", event.target.value)} /></label>
      <label>主来源 <input value={payload.sourcePrimary} onChange={(event) => setField("sourcePrimary", event.target.value)} /></label>
      <label>别名，逗号分隔 <input value={payload.aliases.join(",")} onChange={(event) => setField("aliases", event.target.value.split(",").map((v) => v.trim()).filter(Boolean))} /></label>
      <label>标签，逗号分隔 <input value={payload.tags.join(",")} onChange={(event) => setField("tags", event.target.value.split(",").map((v) => v.trim()).filter(Boolean))} /></label>
      <button type="submit">保存</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
```

- [ ] **Step 3: Add admin pages and wire app**

Create `apps/web/src/pages/AdminWorksPage.tsx`:

```tsx
import { createAdminWork, type WorkPayload } from "../api";
import { WorkForm } from "../components/WorkForm";

export function AdminWorksPage() {
  async function handleCreate(payload: WorkPayload) {
    await createAdminWork(payload);
  }

  return (
    <section>
      <h1>新建作品</h1>
      <WorkForm onSubmit={handleCreate} />
    </section>
  );
}
```

Create `apps/web/src/pages/AdminWorkEditPage.tsx`:

```tsx
export function AdminWorkEditPage() {
  return <p>编辑页将在作品列表选择后接入。</p>;
}
```

Modify `apps/web/src/App.tsx` admin branch:

```tsx
import { AdminWorksPage } from "./pages/AdminWorksPage";
```

Replace the admin branch with:

```tsx
{page.name === "admin" ? (
  <AdminWorksPage />
) : null}
```

- [ ] **Step 4: Run web typecheck**

Run:

```powershell
pnpm --filter @samdb/web typecheck
```

Expected: TypeScript reports no errors.

## Task 8: Add Releases, Access Entries, Taxonomies, Relations, and Import-Export

**Files:**
- Create: `apps/api/src/services/taxonomies.ts`
- Create: `apps/api/src/services/relations.ts`
- Create: `apps/api/src/services/importExport.ts`
- Modify: `apps/api/src/routes/admin.ts`
- Modify: `apps/api/src/routes/public.ts`
- Create: `apps/web/src/components/RelationList.tsx`

- [ ] **Step 1: Implement taxonomy service**

Create `apps/api/src/services/taxonomies.ts`:

```ts
import type { SamDb } from "../db";
import { nowIso } from "../db";

export function createTaxonomy(db: SamDb, input: { id: string; code: string; name: string; description?: string }) {
  const now = nowIso();
  db.prepare(`
    INSERT INTO taxonomies (id, code, name, description, is_system, created_at, updated_at)
    VALUES (@id, @code, @name, @description, 0, @now, @now)
  `).run({ ...input, description: input.description ?? null, now });
}

export function listTaxonomies(db: SamDb) {
  return db.prepare("SELECT * FROM taxonomies ORDER BY code").all();
}

export function createTerm(db: SamDb, input: { id: string; taxonomyId: string; parentId?: string | null; label: string; slug: string; description?: string }) {
  const now = nowIso();
  db.prepare(`
    INSERT INTO taxonomy_terms (id, taxonomy_id, parent_id, label, slug, description, created_at, updated_at)
    VALUES (@id, @taxonomyId, @parentId, @label, @slug, @description, @now, @now)
  `).run({ ...input, parentId: input.parentId ?? null, description: input.description ?? null, now });
}

export function listTermsByTaxonomyCode(db: SamDb, code: string) {
  return db.prepare(`
    SELECT taxonomy_terms.*
    FROM taxonomy_terms
    JOIN taxonomies ON taxonomies.id = taxonomy_terms.taxonomy_id
    WHERE taxonomies.code = ?
    ORDER BY taxonomy_terms.sort_order, taxonomy_terms.label
  `).all(code);
}
```

- [ ] **Step 2: Implement relation service**

Create `apps/api/src/services/relations.ts`:

```ts
import { workRelationSchema, type WorkRelationInput } from "@samdb/shared";
import type { SamDb } from "../db";
import { nowIso } from "../db";

export function createWorkRelation(db: SamDb, input: WorkRelationInput) {
  const parsed = workRelationSchema.parse(input);
  if (parsed.sourceWorkId === parsed.targetWorkId) {
    throw new Error("A work cannot relate to itself");
  }
  const now = nowIso();
  db.prepare(`
    INSERT INTO work_relations (
      source_work_id, target_work_id, relation_type, direction,
      note, confidence, visibility, created_at, updated_at
    ) VALUES (
      @sourceWorkId, @targetWorkId, @relationType, @direction,
      @note, @confidence, @visibility, @now, @now
    )
  `).run({ ...parsed, note: parsed.note ?? null, now });
}

export function listRelationsForWork(db: SamDb, workId: string) {
  return db.prepare(`
    SELECT work_relations.*, target.title AS target_title
    FROM work_relations
    JOIN works AS target ON target.id = work_relations.target_work_id
    WHERE work_relations.source_work_id = ?
    ORDER BY relation_type, target.title
  `).all(workId);
}
```

- [ ] **Step 3: Implement import-export service**

Create `apps/api/src/services/importExport.ts`:

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import type { SamDb } from "../db";
import { listWorks } from "./works";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function exportWorksToMarkdown(db: SamDb, outputDir = resolve(__dirname, "../../../../data/exports/works")): string[] {
  mkdirSync(outputDir, { recursive: true });
  const files: string[] = [];
  for (const work of listWorks(db, {}).items) {
    const body = YAML.stringify(work);
    const file = resolve(outputDir, `${work.id}.md`);
    writeFileSync(file, `---\n${body}---\n\n# ${work.title}\n`, "utf8");
    files.push(file);
  }
  return files;
}
```

- [ ] **Step 4: Add routes for these services**

Modify `apps/api/src/routes/admin.ts` to import and add:

```ts
import { exportWorksToMarkdown } from "../services/importExport";
import { createWorkRelation, listRelationsForWork } from "../services/relations";
import { createTaxonomy, createTerm, listTaxonomies, listTermsByTaxonomyCode } from "../services/taxonomies";
```

Add routes before `return app`:

```ts
app.get("/taxonomies", (c) => c.json({ items: listTaxonomies(db) }));

app.post("/taxonomies", async (c) => {
  createTaxonomy(db, await c.req.json());
  return c.json({ ok: true }, 201);
});

app.get("/taxonomies/:code/terms", (c) => c.json({ items: listTermsByTaxonomyCode(db, c.req.param("code")) }));

app.post("/taxonomies/:code/terms", async (c) => {
  const body = await c.req.json();
  createTerm(db, body);
  return c.json({ ok: true }, 201);
});

app.get("/works/:id/relations", (c) => c.json({ items: listRelationsForWork(db, c.req.param("id")) }));

app.post("/works/:id/relations", async (c) => {
  createWorkRelation(db, { ...(await c.req.json()), sourceWorkId: c.req.param("id") });
  return c.json({ ok: true }, 201);
});

app.post("/export", (c) => c.json({ files: exportWorksToMarkdown(db) }));
```

Modify `apps/api/src/routes/public.ts` to import:

```ts
import { listRelationsForWork } from "../services/relations";
import { listTaxonomies, listTermsByTaxonomyCode } from "../services/taxonomies";
```

Add routes before `return app`:

```ts
app.get("/works/:id/relations", (c) => c.json({ items: listRelationsForWork(db, c.req.param("id")) }));
app.get("/taxonomies", (c) => c.json({ items: listTaxonomies(db) }));
app.get("/taxonomies/:code", (c) => c.json({ items: listTermsByTaxonomyCode(db, c.req.param("code")) }));
```

- [ ] **Step 5: Create relation list component**

Create `apps/web/src/components/RelationList.tsx`:

```tsx
type Relation = {
  id: number;
  relation_type: string;
  target_work_id: string;
  target_title: string;
  note: string | null;
};

type RelationListProps = {
  relations: Relation[];
};

export function RelationList({ relations }: RelationListProps) {
  if (relations.length === 0) return <p className="muted">暂无关联作品。</p>;

  const groups = relations.reduce<Record<string, Relation[]>>((acc, relation) => {
    acc[relation.relation_type] = acc[relation.relation_type] ?? [];
    acc[relation.relation_type].push(relation);
    return acc;
  }, {});

  return (
    <div>
      {Object.entries(groups).map(([type, items]) => (
        <section key={type}>
          <h3>{type}</h3>
          {items.map((item) => (
            <article className="work-card" key={item.id}>
              <strong>{item.target_title}</strong>
              {item.note ? <p>{item.note}</p> : null}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Run tests and typechecks**

Run:

```powershell
pnpm test
pnpm typecheck
```

Expected: all tests pass and TypeScript reports no errors.

## Task 9: Final Verification

**Files:**
- No new files required.

- [ ] **Step 1: Seed the database**

Run:

```powershell
pnpm --filter @samdb/api seed
```

Expected: `Seed complete`.

- [ ] **Step 2: Start the app**

Run:

```powershell
pnpm dev
```

Expected:

```text
SAMDB API listening on http://localhost:8787
VITE ready in ...
```

- [ ] **Step 3: Verify API health**

Run in a second terminal:

```powershell
Invoke-RestMethod http://localhost:8787/health
Invoke-RestMethod http://localhost:8787/api/public/works
```

Expected: health returns `{ ok = True }` and works returns an `items` array containing `sample-work`.

- [ ] **Step 4: Verify browser UI**

Open:

```text
http://localhost:5173
```

Expected:

- The作品 list loads.
- The `示例作品` card appears.
- Opening the card shows title, summary, tags, and source.
- The 后台 tab shows the create-work form.

- [ ] **Step 5: Verify no internal access fields leak**

After adding an access entry in later UI/API work, call the public endpoint and confirm these keys are absent:

```text
mirrorNote
accessRisk
checksum
extractCode
internalPath
sensitiveSource
mirror_note
access_risk
extract_code
internal_path
sensitive_source
```

For the current MVP slice, the shared visibility test is the automated evidence.
