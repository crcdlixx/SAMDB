import { createDatabase, initializeDatabase, nowIso } from "./db";

const db = createDatabase(process.env.SAMDB_DATABASE_PATH);
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
  INSERT OR IGNORE INTO works (
    id, title, aliases_json, summary_short, source_primary,
    record_status, visibility, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  "sample-related-work",
  "示例关联作品",
  JSON.stringify(["Related Sample Work"]),
  "用于验证作品关系的示例作品。",
  "https://example.test/related-source",
  "published",
  "public",
  now,
  now
);

db.prepare(`
  INSERT OR IGNORE INTO contributors (
    work_id, name, role, credit_name, note, visibility, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  "sample-work",
  "示例作者",
  "author",
  "示例署名",
  "用于验证公开制作人员展示。",
  "public",
  now,
  now
);

db.prepare(`
  INSERT OR IGNORE INTO covers (
    id, work_id, release_id, url, source, is_primary, process_note,
    visibility, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  "cover-sample-work-main",
  "sample-work",
  null,
  "https://placehold.co/480x640?text=SAMDB",
  "placeholder",
  1,
  "用于验证公开封面展示。",
  "public",
  now,
  now
);

db.prepare(`
  INSERT OR IGNORE INTO taxonomies (
    id, code, name, description, is_system, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`).run("tax-work-type", "work_type", "作品类型", "作品类型分类体系", 1, now, now);

db.prepare(`
  INSERT OR IGNORE INTO taxonomies (
    id, code, name, description, is_system, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`).run("tax-theme", "theme", "题材", "题材与内容标签", 1, now, now);

db.prepare(`
  INSERT OR IGNORE INTO taxonomy_terms (
    id, taxonomy_id, label, slug, description, sort_order, is_active, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run("term-theme-demo", "tax-theme", "示例题材", "demo-theme", "用于验证分类挂载的题材项", 0, 1, now, now);

db.prepare(`
  INSERT OR IGNORE INTO work_taxonomy_terms (
    work_id, term_id, relation_type, confidence, note, created_at
  ) VALUES (?, ?, ?, ?, ?, ?)
`).run("sample-work", "term-theme-demo", "theme", "manual", "seed 示例挂载", now);

db.prepare(`
  INSERT OR IGNORE INTO releases (
    release_id, parent_work_id, release_title, release_date, edition,
    audio_tracks_json, subtitle_tracks_json, release_status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  "rel-sample-work-v1",
  "sample-work",
  "示例作品 初版",
  "2026-06-07",
  "initial",
  JSON.stringify([]),
  JSON.stringify([{ language: "zh-CN", format: "srt", type: "external" }]),
  "published",
  now,
  now
);

db.prepare(`
  INSERT OR IGNORE INTO access_entries (
    access_id, parent_release_id, access_type, platform, url,
    availability, access_note, extract_code, internal_path, visibility,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  "acc-sample-work-official",
  "rel-sample-work-v1",
  "official_streaming",
  "Example Platform",
  "https://example.test/watch",
  "可访问",
  "公开示例链接",
  "1234",
  "D:/secret/sample-work",
  "restricted",
  now,
  now
);

db.prepare(`
  INSERT OR IGNORE INTO sources (
    work_id, source_type, url, title, evidence_level, note,
    visibility, last_checked, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  "sample-work",
  "official",
  "https://example.test/source",
  "示例官方来源",
  "primary",
  "用于验证公开来源展示。",
  "public",
  null,
  now,
  now
);

db.prepare(`
  INSERT OR IGNORE INTO external_links (
    work_id, target_type, title, url, relation_type,
    visibility, note, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  "sample-work",
  "official_site",
  "示例官方网站",
  "https://example.test/official",
  "homepage",
  "public",
  "用于验证外部链接展示。",
  now,
  now
);

db.prepare(`
  INSERT OR IGNORE INTO work_relations (
    source_work_id, target_work_id, relation_type, direction,
    note, confidence, visibility, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  "sample-work",
  "sample-related-work",
  "related",
  "bidirectional",
  "seed 示例关联",
  "manual",
  "public",
  now,
  now
);

console.log("Seed complete");
