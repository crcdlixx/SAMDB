import { workRelationSchema, type WorkRelationInput } from "@samdb/shared";
import type { SamDb } from "../db";
import { nowIso } from "../db";

type WorkRelationRow = {
  id: number;
  source_work_id: string;
  target_work_id: string;
  relation_type: string;
  direction: string;
  note: string | null;
  confidence: string;
  visibility: string;
  created_at: string;
  updated_at: string;
  target_title?: string;
  source_title?: string;
  source_year?: string | null;
  target_year?: string | null;
  source_visibility?: string;
  source_record_status?: string;
  target_visibility?: string;
  target_record_status?: string;
};

export type WorkRelationView = WorkRelationRow & {
  target_title: string;
};

function toWorkRelationView(row: WorkRelationRow): WorkRelationView {
  return {
    ...row,
    target_title: row.target_title ?? ""
  };
}

export function createWorkRelation(db: SamDb, input: WorkRelationInput): WorkRelationView {
  const parsed = workRelationSchema.parse(input);
  if (parsed.sourceWorkId === parsed.targetWorkId) {
    throw new Error("A work cannot relate to itself");
  }
  const now = nowIso();
  const result = db.prepare(`
    INSERT INTO work_relations (
      source_work_id, target_work_id, relation_type, direction,
      note, confidence, visibility, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    parsed.sourceWorkId,
    parsed.targetWorkId,
    parsed.relationType,
    parsed.direction,
    parsed.note ?? null,
    parsed.confidence,
    parsed.visibility,
    now,
    now
  ) as { lastInsertRowid?: number | bigint };

  const created = getWorkRelationById(db, Number(result.lastInsertRowid));
  if (!created) throw new Error("Work relation was not created");
  return created;
}

export function getWorkRelationById(db: SamDb, id: number): WorkRelationView | null {
  const row = db.prepare(`
    SELECT work_relations.*, target.title AS target_title
    FROM work_relations
    JOIN works AS target ON target.id = work_relations.target_work_id
    WHERE work_relations.id = ?
  `).get(id) as WorkRelationRow | undefined;
  return row ? toWorkRelationView(row) : null;
}

export function updateWorkRelation(db: SamDb, id: number, input: Partial<Omit<WorkRelationInput, "sourceWorkId" | "targetWorkId">>): WorkRelationView {
  const existing = getWorkRelationById(db, id);
  if (!existing) throw new Error(`Work relation not found: ${id}`);

  db.prepare(`
    UPDATE work_relations SET
      relation_type = ?,
      direction = ?,
      note = ?,
      confidence = ?,
      visibility = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    input.relationType ?? existing.relation_type,
    input.direction ?? existing.direction,
    input.note ?? existing.note,
    input.confidence ?? existing.confidence,
    input.visibility ?? existing.visibility,
    nowIso(),
    id
  );

  const updated = getWorkRelationById(db, id);
  if (!updated) throw new Error("Work relation disappeared after update");
  return updated;
}

export function deleteWorkRelation(db: SamDb, id: number): WorkRelationView {
  const existing = getWorkRelationById(db, id);
  if (!existing) throw new Error(`Work relation not found: ${id}`);
  db.prepare("DELETE FROM work_relations WHERE id = ?").run(id);
  return existing;
}

export function listRelationsForWork(db: SamDb, workId: string): WorkRelationView[] {
  const rows = db.prepare(`
    SELECT work_relations.*, target.title AS target_title
    FROM work_relations
    JOIN works AS target ON target.id = work_relations.target_work_id
    WHERE work_relations.source_work_id = ?
    ORDER BY relation_type, target.title
  `).all(workId) as WorkRelationRow[];
  return rows.map(toWorkRelationView);
}

export function listPublicRelationsForWork(db: SamDb, workId: string): WorkRelationView[] {
  const rows = db.prepare(`
    SELECT work_relations.*, target.title AS target_title
    FROM work_relations
    JOIN works AS target ON target.id = work_relations.target_work_id
    WHERE work_relations.source_work_id = ?
      AND work_relations.visibility = 'public'
      AND target.visibility = 'public'
      AND target.record_status = 'published'
    ORDER BY relation_type, target.title
  `).all(workId) as WorkRelationRow[];
  return rows.map(toWorkRelationView);
}

export type RelationNetworkItem = {
  relationId: number;
  workId: string;
  title: string;
  year: string | null;
  relationType: string;
  group: string;
  label: string;
  reverse: boolean;
  note: string | null;
};

export type RelationNetworkGroup = {
  group: string;
  label: string;
  items: RelationNetworkItem[];
};

const relationMeta: Record<string, { group: string; forward: string; reverse: string }> = {
  same_series: { group: "series", forward: "同系列", reverse: "同系列" },
  prequel: { group: "series", forward: "续作", reverse: "前作" },
  sequel: { group: "series", forward: "前作", reverse: "续作" },
  remake: { group: "version", forward: "重制版", reverse: "原版本" },
  remaster: { group: "version", forward: "修复版", reverse: "原版本" },
  adaptation_of: { group: "adaptation", forward: "改编自", reverse: "被改编为" },
  adapted_to: { group: "adaptation", forward: "被改编为", reverse: "改编自" },
  spin_off: { group: "derivative", forward: "衍生作品", reverse: "衍生自" },
  compilation_of: { group: "collection", forward: "合集收录", reverse: "被收录于" },
  included_in: { group: "collection", forward: "被收录于", reverse: "合集收录" },
  alternate_version: { group: "version", forward: "另版本", reverse: "另版本" },
  translation_of: { group: "version", forward: "翻译版本", reverse: "被翻译为" },
  subtitle_version: { group: "version", forward: "字幕版本", reverse: "字幕来源" },
  fanwork_of: { group: "derivative", forward: "基于", reverse: "同人/二创" },
  inspired_by: { group: "reference", forward: "灵感来源", reverse: "启发了" },
  references: { group: "reference", forward: "引用/致敬", reverse: "被引用/致敬" },
  related: { group: "related", forward: "相关", reverse: "相关" }
};

const groupLabels: Record<string, string> = {
  series: "系列关系",
  adaptation: "改编关系",
  derivative: "衍生关系",
  version: "版本关系",
  collection: "收录关系",
  reference: "参考关系",
  related: "其他关联"
};

function metaFor(type: string) {
  return relationMeta[type] ?? relationMeta.related;
}

function groupNetworkItems(items: RelationNetworkItem[]): RelationNetworkGroup[] {
  const groups = new Map<string, RelationNetworkItem[]>();
  for (const item of items) {
    groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  }
  return Array.from(groups.entries()).map(([group, groupItems]) => ({
    group,
    label: groupLabels[group] ?? group,
    items: groupItems.sort((a, b) => a.title.localeCompare(b.title))
  }));
}

export function listPublicRelationNetworkForWork(db: SamDb, workId: string): { groups: RelationNetworkGroup[] } {
  const rows = db.prepare(`
    SELECT
      work_relations.*,
      source.title AS source_title,
      source.year AS source_year,
      target.title AS target_title,
      target.year AS target_year
    FROM work_relations
    JOIN works AS source ON source.id = work_relations.source_work_id
    JOIN works AS target ON target.id = work_relations.target_work_id
    WHERE work_relations.visibility = 'public'
      AND (
        (work_relations.source_work_id = ? AND target.visibility = 'public' AND target.record_status = 'published')
        OR
        (work_relations.target_work_id = ? AND source.visibility = 'public' AND source.record_status = 'published')
      )
  `).all(workId, workId) as WorkRelationRow[];

  const items = rows.map((row): RelationNetworkItem => {
    const reverse = row.target_work_id === workId;
    const meta = metaFor(row.relation_type);
    return {
      relationId: row.id,
      workId: reverse ? row.source_work_id : row.target_work_id,
      title: reverse ? row.source_title ?? "" : row.target_title ?? "",
      year: reverse ? row.source_year ?? null : row.target_year ?? null,
      relationType: row.relation_type,
      group: meta.group,
      label: reverse ? meta.reverse : meta.forward,
      reverse,
      note: row.note
    };
  });

  return { groups: groupNetworkItems(items) };
}

export type SeriesSummary = {
  name: string;
  workCount: number;
};

export type SeriesDetail = {
  name: string;
  works: Array<{ id: string; title: string; year: string | null; summaryShort: string }>;
};

export function listSeriesSummaries(db: SamDb): { items: SeriesSummary[] } {
  const summaries = new Map<string, Set<string>>();
  const seriesRows = db.prepare(`
    SELECT id, series
    FROM works
    WHERE visibility = 'public' AND record_status = 'published' AND series IS NOT NULL AND TRIM(series) != ''
  `).all() as Array<{ id: string; series: string }>;
  for (const row of seriesRows) {
    summaries.set(row.series, new Set([...(summaries.get(row.series) ?? []), row.id]));
  }

  const relationRows = db.prepare(`
    SELECT source.id AS source_id, source.title AS source_title, target.id AS target_id, target.title AS target_title
    FROM work_relations
    JOIN works AS source ON source.id = work_relations.source_work_id
    JOIN works AS target ON target.id = work_relations.target_work_id
    WHERE work_relations.visibility = 'public'
      AND work_relations.relation_type IN ('same_series', 'prequel', 'sequel')
      AND source.visibility = 'public'
      AND source.record_status = 'published'
      AND target.visibility = 'public'
      AND target.record_status = 'published'
  `).all() as Array<{ source_id: string; source_title: string; target_id: string; target_title: string }>;
  for (const row of relationRows) {
    const name = `${row.source_title} / ${row.target_title}`;
    summaries.set(name, new Set([row.source_id, row.target_id]));
  }

  return {
    items: Array.from(summaries.entries())
      .map(([name, ids]) => ({ name, workCount: ids.size }))
      .sort((a, b) => a.name.localeCompare(b.name))
  };
}

export function getSeriesDetail(db: SamDb, name: string): SeriesDetail | null {
  const rows = db.prepare(`
    SELECT id, title, year, summary_short
    FROM works
    WHERE visibility = 'public'
      AND record_status = 'published'
      AND series = ?
    ORDER BY COALESCE(year, ''), title
  `).all(name) as Array<{ id: string; title: string; year: string | null; summary_short: string }>;

  if (rows.length > 0) {
    return {
      name,
      works: rows.map((row) => ({
        id: row.id,
        title: row.title,
        year: row.year,
        summaryShort: row.summary_short
      }))
    };
  }

  const relationRows = db.prepare(`
    SELECT source.id AS source_id,
      source.title AS source_title,
      source.year AS source_year,
      source.summary_short AS source_summary_short,
      target.id AS target_id,
      target.title AS target_title,
      target.year AS target_year,
      target.summary_short AS target_summary_short
    FROM work_relations
    JOIN works AS source ON source.id = work_relations.source_work_id
    JOIN works AS target ON target.id = work_relations.target_work_id
    WHERE work_relations.visibility = 'public'
      AND work_relations.relation_type IN ('same_series', 'prequel', 'sequel')
      AND source.visibility = 'public'
      AND source.record_status = 'published'
      AND target.visibility = 'public'
      AND target.record_status = 'published'
      AND (source.title || ' / ' || target.title) = ?
  `).all(name) as Array<{
    source_id: string;
    source_title: string;
    source_year: string | null;
    source_summary_short: string;
    target_id: string;
    target_title: string;
    target_year: string | null;
    target_summary_short: string;
  }>;

  if (relationRows.length === 0) return null;

  const works = new Map<string, { id: string; title: string; year: string | null; summaryShort: string }>();
  for (const row of relationRows) {
    works.set(row.source_id, {
      id: row.source_id,
      title: row.source_title,
      year: row.source_year,
      summaryShort: row.source_summary_short
    });
    works.set(row.target_id, {
      id: row.target_id,
      title: row.target_title,
      year: row.target_year,
      summaryShort: row.target_summary_short
    });
  }

  return {
    name,
    works: Array.from(works.values()).sort((a, b) => `${a.year ?? ""}${a.title}`.localeCompare(`${b.year ?? ""}${b.title}`))
  };
}

export type RelationQualityIssue = {
  issueType: "public_to_private" | "weak_relation_without_note" | "direction_conflict";
  relationId: number;
  message: string;
};

export function listRelationQualityIssues(db: SamDb): { items: RelationQualityIssue[] } {
  const rows = db.prepare(`
    SELECT
      work_relations.*,
      source.title AS source_title,
      source.visibility AS source_visibility,
      source.record_status AS source_record_status,
      target.title AS target_title,
      target.visibility AS target_visibility,
      target.record_status AS target_record_status
    FROM work_relations
    JOIN works AS source ON source.id = work_relations.source_work_id
    JOIN works AS target ON target.id = work_relations.target_work_id
  `).all() as WorkRelationRow[];

  const issues: RelationQualityIssue[] = [];
  for (const row of rows) {
    if (row.visibility === "public" && (row.target_visibility !== "public" || row.target_record_status !== "published")) {
      issues.push({
        issueType: "public_to_private",
        relationId: row.id,
        message: `公开关系指向非公开作品：${row.target_title ?? row.target_work_id}`
      });
    }
    if (row.relation_type === "related" && !row.note?.trim()) {
      issues.push({
        issueType: "weak_relation_without_note",
        relationId: row.id,
        message: "泛关联关系缺少说明"
      });
    }
  }

  const directional = rows.filter((row) => row.relation_type === "prequel" || row.relation_type === "sequel");
  for (const row of directional) {
    const conflict = directional.find((candidate) =>
      candidate.id !== row.id
      && candidate.source_work_id === row.target_work_id
      && candidate.target_work_id === row.source_work_id
      && candidate.relation_type !== row.relation_type
    );
    if (conflict) {
      issues.push({
        issueType: "direction_conflict",
        relationId: row.id,
        message: "前作/续作方向存在冲突"
      });
    }
  }

  return { items: issues };
}
