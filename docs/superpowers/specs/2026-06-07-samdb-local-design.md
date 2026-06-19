---
title: SAMDB 本地版星图作品元数据库网页系统设计
created: 2026-06-07
status: draft
source_docs:
  - D:/NewStarProject/SAfile/SA4-星图作品元数据库建设方案.md
  - D:/NewStarProject/SAfile/SA5-星图作品元数据库字段与模板规范.md
---

# SAMDB 本地版星图作品元数据库网页系统设计

## 1. 目标

SAMDB 是一个本地运行的作品元数据库网页系统，用于管理作品、版本、获取方式、制作人员、封面、来源、分类挂载和作品关系。

系统继承 SA4/SA5 中关于作品主记录、版本记录、获取记录的字段分层与公开级别原则，但不把自身绑定到星图 L1-L5 分类体系。星图分类只作为可选 taxonomy 存在，与作品库核心模型分离。

第一版目标是做出可本地使用的前后端分离系统：

- 公开检索站：浏览、搜索、筛选、查看公开作品详情。
- 本地管理后台：录入、编辑、维护版本、获取方式、分类挂载和作品关系。
- SQLite 主库：保存运行数据。
- Markdown/YAML 导入导出：作为长期可迁移格式和备份镜像。
- 本地资产目录：保存封面和导出文件。

## 2. 非目标

第一版不实现以下内容：

- 云部署和 Cloudflare 集成。
- 多人账号、复杂角色权限和组织协作。
- 复杂交互式关系图谱。
- 全文搜索引擎。
- 自动采集、自动审核或 Agent 发布流程。
- 与星图主知识库的强绑定分类同步。

这些能力可以在核心模型稳定后逐步加入。

## 3. 系统架构

```text
SAMDB
  apps/web
    React + Vite + TypeScript 前端

  apps/api
    Node.js + Hono 后端 API

  packages/db
    SQLite schema
    Drizzle ORM
    migrations
    query helpers

  packages/shared
    共享类型
    枚举值
    Zod 校验规则

  data
    samdb.sqlite
    assets/covers
    imports
    exports
```

前端只调用后端 API，不直接读取 SQLite。后端负责字段过滤、数据校验、导入导出和审计记录。

## 4. 核心领域模型

系统分为五层：

```text
作品层：Work / Release / AccessEntry
分类层：Taxonomy / TaxonomyTerm / WorkTaxonomyTerm
关系层：WorkRelation
外链层：ExternalLink
治理层：Source / AuditLog
```

### 4.1 作品层

作品层记录作品事实元数据，不保存星图 L1-L5 分类字段。

- `works`：作品主记录，保存标题、别名、简介、年份、语言、状态等稳定字段；作品类型通过 `work_type` taxonomy 挂载。
- `releases`：版本记录，保存发布批次、字幕、音轨、分辨率、版本状态等字段。
- `access_entries`：获取方式记录，保存平台、公开链接、可用性、内部路径、提取码等字段。
- `contributors`：制作人员记录，保存署名、角色、公开级别。
- `covers`：封面元数据，文件保存在本地资产目录。

### 4.2 分类适配层

分类体系是可插拔适配层，不是作品主表的一部分。

- `taxonomies`：分类体系，例如 `work_type`、`platform`、`language`、`theme`、`staratlas`。
- `taxonomy_terms`：分类项，支持树状父子结构。
- `work_taxonomy_terms`：作品与分类项的挂载关系。

星图分类以 `staratlas` taxonomy 表达。它可以有 L1/L2/L3/L4 结构，但只是一个可选分类入口。

### 4.3 作品关系层

作品之间的语义关系单独建模，不能只用标签替代。

- `work_relations`：记录作品与作品之间的关系。

第一版支持关系类型：

- `same_series`：同系列
- `sequel`：续作
- `prequel`：前作
- `remake`：重制
- `remaster`：高清修复或重制版
- `adaptation_of`：改编自
- `adapted_to`：被改编为
- `spin_off`：衍生作品
- `compilation_of`：合集收录
- `included_in`：被收录于
- `alternate_version`：另一版本
- `translation_of`：翻译或本地化版本
- `subtitle_version`：字幕版本
- `fanwork_of`：同人或二创基于
- `inspired_by`：灵感来源
- `references`：引用或致敬
- `related`：泛关联

### 4.4 外链层

外链用于连接星图词条、官方网站、外部百科、档案页等外部资源。

- `external_links`：保存外部目标类型、标题、链接、关系说明和公开级别。

外链不是作品关系。作品关系只连接本系统内的作品记录。

### 4.5 治理层

- `sources`：来源与证据记录。
- `audit_logs`：后台写操作日志。

第一版本地单用户模式也要记录审计日志，便于之后回溯修改。

## 5. 数据表草案

### 5.1 works

```sql
CREATE TABLE works (
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
```

`work_type` 不放在主表作为唯一分类来源。第一版可以通过 `work_taxonomy_terms` 挂载 `work_type` taxonomy。为便于列表性能，可后续增加派生缓存字段。

### 5.2 releases

```sql
CREATE TABLE releases (
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
  FOREIGN KEY (parent_work_id) REFERENCES works(id)
);
```

### 5.3 access_entries

```sql
CREATE TABLE access_entries (
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
  FOREIGN KEY (parent_release_id) REFERENCES releases(release_id)
);
```

公开 API 永远不返回 `mirror_note`、`access_risk`、`checksum`、`extract_code`、`internal_path`、`sensitive_source`。

### 5.4 contributors

```sql
CREATE TABLE contributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  credit_name TEXT,
  note TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id)
);
```

### 5.5 covers

```sql
CREATE TABLE covers (
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
  FOREIGN KEY (work_id) REFERENCES works(id),
  FOREIGN KEY (release_id) REFERENCES releases(release_id)
);
```

### 5.6 taxonomies

```sql
CREATE TABLE taxonomies (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 5.7 taxonomy_terms

```sql
CREATE TABLE taxonomy_terms (
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
  FOREIGN KEY (taxonomy_id) REFERENCES taxonomies(id),
  FOREIGN KEY (parent_id) REFERENCES taxonomy_terms(id)
);
```

### 5.8 work_taxonomy_terms

```sql
CREATE TABLE work_taxonomy_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL,
  term_id TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'tag',
  confidence TEXT NOT NULL DEFAULT 'manual',
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id),
  FOREIGN KEY (term_id) REFERENCES taxonomy_terms(id)
);
```

### 5.9 work_relations

```sql
CREATE TABLE work_relations (
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
  FOREIGN KEY (source_work_id) REFERENCES works(id),
  FOREIGN KEY (target_work_id) REFERENCES works(id)
);
```

校验规则：

- `source_work_id` 不能等于 `target_work_id`。
- 同一来源、目标、关系类型不应重复。
- `same_series`、`alternate_version`、`related` 默认可双向。
- `sequel`、`prequel`、`adaptation_of`、`fanwork_of` 默认有方向。

### 5.10 external_links

```sql
CREATE TABLE external_links (
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
  FOREIGN KEY (work_id) REFERENCES works(id)
);
```

### 5.11 sources

```sql
CREATE TABLE sources (
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
  FOREIGN KEY (work_id) REFERENCES works(id)
);
```

### 5.12 audit_logs

```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);
```

## 6. 页面设计

### 6.1 公开站

```text
/works
  作品列表，支持标题、别名、制作人员、标签搜索。

/works/:id
  作品详情页，展示公开字段、版本、公开获取方式、制作人员、来源、关联作品和外链。

/works/:id/relations
  作品关系页，按关系类型分组展示关联作品。

/taxonomies
  分类体系入口。

/taxonomies/:code
  某套分类体系浏览页，例如 work_type、platform、theme、staratlas。

/taxonomies/:code/:term
  某个分类项下的作品列表。

/search
  全站搜索入口。
```

### 6.2 管理后台

```text
/admin
  仪表盘。

/admin/works
  作品管理列表。

/admin/works/new
  新建作品。

/admin/works/:id
  编辑作品主记录。

/admin/works/:id/releases
  版本管理。

/admin/works/:id/access
  获取方式管理。

/admin/works/:id/relations
  作品关系管理。

/admin/works/:id/taxonomies
  分类挂载管理。

/admin/taxonomies
  分类体系管理。

/admin/import-export
  Markdown/YAML 导入导出。

/admin/audit-logs
  操作日志。
```

## 7. API 设计

公开 API：

```text
GET /api/public/works
GET /api/public/works/:id
GET /api/public/works/:id/relations
GET /api/public/taxonomies
GET /api/public/taxonomies/:code
GET /api/public/search
```

后台 API：

```text
GET    /api/admin/works
POST   /api/admin/works
GET    /api/admin/works/:id
PATCH  /api/admin/works/:id
DELETE /api/admin/works/:id

GET    /api/admin/works/:id/releases
POST   /api/admin/works/:id/releases
PATCH  /api/admin/releases/:releaseId
DELETE /api/admin/releases/:releaseId

GET    /api/admin/releases/:releaseId/access
POST   /api/admin/releases/:releaseId/access
PATCH  /api/admin/access/:accessId
DELETE /api/admin/access/:accessId

GET    /api/admin/taxonomies
POST   /api/admin/taxonomies
GET    /api/admin/taxonomies/:code/terms
POST   /api/admin/taxonomies/:code/terms

GET    /api/admin/works/:id/relations
POST   /api/admin/works/:id/relations
PATCH  /api/admin/relations/:id
DELETE /api/admin/relations/:id

POST   /api/admin/import
POST   /api/admin/export
GET    /api/admin/audit-logs
```

本地第一版不需要复杂登录。后台可以默认只绑定 `localhost`，后续再加本地密码或用户表。

## 8. 公开字段过滤

公开 API 必须过滤受限和内部字段。尤其是 `access_entries`：

允许公开返回：

- `access_type`
- `platform`
- `url`
- `availability`
- `access_note`
- `last_verified`

禁止公开返回：

- `mirror_note`
- `access_risk`
- `checksum`
- `extract_code`
- `internal_path`
- `sensitive_source`

前端隐藏字段不能作为安全边界。所有过滤必须在后端 API 实现。

## 9. 导入导出

导入来源：

- SA5 风格 YAML/Markdown 单文件记录。
- 后续扩展为 `works/`、`releases/`、`access/` 分目录导入。

导出目标：

```text
data/exports/works
data/exports/releases
data/exports/access
data/exports/snapshots
```

导出格式优先使用 Markdown 文件加 YAML frontmatter。导出的内部字段必须按模式区分：

- public export：只导出公开字段。
- admin export：导出受限字段。
- full backup：导出完整字段，仅本地管理员使用。

## 10. 校验规则

发布作品前：

- `id` 唯一。
- `title` 不为空。
- `summary_short` 不为空。
- `source_primary` 不为空。
- 至少有一条来源记录或主来源。
- `record_status` 合法。
- 公开字段中不得出现疑似提取码、内部路径、口令。

发布获取方式前：

- `access_type` 不为空。
- `internal_archive` 不能设置为公开。
- `extract_code`、`internal_path` 不得通过公开 API 返回。
- 公开 URL 应为可展示链接。

发布作品关系前：

- 目标作品存在。
- 不允许作品关联自身。
- 不允许重复关系。
- 有方向关系需要确认方向。

## 11. MVP 开发顺序

1. 初始化 monorepo。
2. 配置 TypeScript、前端、后端、共享包。
3. 建 SQLite schema 和迁移。
4. 实现 works CRUD API。
5. 实现公开作品列表和详情页。
6. 实现后台作品编辑页。
7. 实现 releases 和 access_entries。
8. 实现 taxonomies 和分类挂载。
9. 实现 work_relations。
10. 实现导入导出。
11. 实现公开字段过滤和基础校验。
12. 补充审计日志。

## 12. 成功标准

第一版完成后，应能做到：

- 本地启动前端和后端。
- 在后台新建一部作品并保存到 SQLite。
- 给作品添加版本、获取方式、分类项和关联作品。
- 公开站能浏览作品列表和详情。
- 公开站不会泄露内部获取字段。
- 可以导入或导出 Markdown/YAML 快照。
- 星图分类仅作为 `staratlas` taxonomy 存在，不影响核心作品模型。
