---
title: SAMDB 第三阶段设计：批量导入、重复检测与安全备份
created: 2026-06-19
status: draft
scope: phase-3
depends_on:
  - docs/superpowers/specs/2026-06-18-samdb-network-ui-auth-design.md
---

# SAMDB 第三阶段设计：批量导入、重复检测与安全备份

## 1. 阶段目标

第三阶段把 SAMDB 从“可维护的本地资料库”推进到“可批量整理、可安全试导、可追踪导入结果的数据治理工具”。

本阶段聚焦三件事：

- 批量导入预览：一次处理多份 Markdown/YAML 作品资料，先解析、校验和预览，不直接写库。
- 重复检测与冲突处理：在写入前识别可能重复的作品、来源、外链和系列关系，让用户选择跳过、创建、覆盖或合并。
- 写入前自动备份：真正修改 SQLite 前自动创建本地备份，保证批量导入可以回退。

系统继续完全本地运行，数据库继续使用 SQLite。第三阶段不接入云服务，不使用 Cloudflare/D1，不做在线多人协作。

## 2. 非目标

第三阶段不实现以下内容：

- 云同步、云端备份、远程数据库或对象存储。
- AI 自动清洗、自动补字段、自动判断版权或自动发布。
- 附件文件搬运、媒体文件入库、封面图片下载。
- 复杂三方格式全量兼容。第一版只支持 SAMDB Markdown/YAML 和后续可扩展的结构化文本输入。
- 复杂可视化 diff。第一版做字段级对比，不做逐字符富文本 diff。
- 自动恢复数据库。第三阶段提供备份文件和恢复入口设计，恢复执行必须由用户明确确认。

## 3. 当前基础

第二阶段已经具备：

- 本地 SQLite 数据库和完整作品模型。
- Markdown/YAML 单条导入与作品导出。
- 后台权限、用户、会话和审计日志。
- 关系质量检查。
- 后台模块化导航和导入入口。

当前不足：

- 导入是单条即时写入，缺少预览和回滚安全感。
- 导入只创建作品基础字段，未形成批量任务和结果记录。
- 缺少重复检测，容易导入同一作品的不同版本资料。
- 缺少字段级冲突处理，覆盖和合并边界不清楚。
- 缺少导入前自动备份和导入任务审计。

## 4. 总体架构

第三阶段新增“导入治理”层，不改变公共 API 的读取模型。

```text
apps/web
  AdminImportWorkbenchPage
  ImportSourceEditor
  ImportPreviewTable
  ImportCandidateDetail
  DuplicateMatchPanel
  ImportExecutionPanel

apps/api
  import-governance routes
  import preview service
  duplicate detection service
  backup service
  import execution service

SQLite
  import_jobs
  import_candidates
  import_candidate_issues
  import_candidate_matches
  backup_snapshots
  existing works / relations / audit_logs
```

导入流程分为两个阶段：

1. 预览阶段：解析输入、生成候选项、检测错误和重复，不修改作品表。
2. 执行阶段：用户确认每条候选项的动作，系统先备份 SQLite，再写入作品表并记录结果。

## 5. 数据模型

### 5.1 导入任务

新增 `import_jobs`：

```sql
CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL,
  actor TEXT,
  raw_input_path TEXT,
  summary_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  executed_at TEXT
);
```

`status` 取值：

- `previewing`
- `ready`
- `needs_review`
- `executing`
- `completed`
- `failed`
- `cancelled`

### 5.2 导入候选项

新增 `import_candidates`：

```sql
CREATE TABLE import_candidates (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  source_index INTEGER NOT NULL,
  proposed_work_id TEXT,
  proposed_title TEXT,
  parsed_json TEXT NOT NULL,
  status TEXT NOT NULL,
  action TEXT NOT NULL,
  target_work_id TEXT,
  result_work_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES import_jobs(id) ON DELETE CASCADE
);
```

`status` 取值：

- `valid`
- `warning`
- `invalid`
- `ready`
- `imported`
- `skipped`
- `failed`

`action` 取值：

- `create`
- `skip`
- `overwrite`
- `merge`
- `needs_review`

默认规则：

- 没有严重错误且没有强重复：`create`
- 有强重复：`needs_review`
- 必填字段缺失或 YAML 无法解析：`needs_review`

### 5.3 预检问题

新增 `import_candidate_issues`：

```sql
CREATE TABLE import_candidate_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  field_path TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES import_candidates(id) ON DELETE CASCADE
);
```

`severity` 取值：

- `error`：阻止执行。
- `warning`：允许执行，但需要提示。
- `info`：仅记录。

### 5.4 重复匹配

新增 `import_candidate_matches`：

```sql
CREATE TABLE import_candidate_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL,
  existing_work_id TEXT NOT NULL,
  match_type TEXT NOT NULL,
  score REAL NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES import_candidates(id) ON DELETE CASCADE,
  FOREIGN KEY (existing_work_id) REFERENCES works(id) ON DELETE CASCADE
);
```

`match_type`：

- `id_exact`
- `title_exact`
- `alias_exact`
- `source_exact`
- `external_url_exact`
- `series_year_near`
- `title_fuzzy`

### 5.5 备份快照

新增 `backup_snapshots`：

```sql
CREATE TABLE backup_snapshots (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor TEXT,
  related_job_id TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL
);
```

备份文件默认放在：

```text
data/backups/samdb-YYYYMMDD-HHmmss-before-import-<jobId>.sqlite
```

## 6. 导入输入格式

第一版支持两类输入：

- 多份 Markdown/YAML 文本：用 `---` frontmatter 解析，每份代表一个候选作品。
- JSON 数组输入：每个对象代表一个候选作品，主要用于后续工具生成数据。

后台 UI 可以先提供文本区批量粘贴，后续再增加本地文件选择。

解析规则：

- Markdown frontmatter 中的字段优先。
- 正文标题只作为辅助信息，不覆盖 frontmatter 的 `title`。
- 未识别字段保留在 `parsed_json.extra`，不直接写入作品表。
- 解析失败的块也生成 candidate，状态为 `invalid`，方便用户定位。

## 7. 预检规则

### 7.1 必填字段

导入候选项至少需要：

- `id`
- `title`
- `summaryShort`
- `sourcePrimary`
- `recordStatus`
- `visibility`

缺少 `id` 或 `title` 为 `error`。
缺少 `summaryShort` 或 `sourcePrimary` 为 `warning`，但默认动作改为 `needs_review`。

### 7.2 枚举字段

需要校验：

- `recordStatus`
- `visibility`
- release/access/relation 中已有枚举字段。

非法枚举为 `error`。

### 7.3 关系目标

候选项如果包含关系：

- 目标作品已存在：通过。
- 目标作品在同一导入任务中：通过，但标记为 `info`。
- 目标作品不存在：`warning`，关系不自动写入，除非用户确认延后处理。

### 7.4 公开性风险

如果候选项为 public，但包含 internal/restricted 的获取方式或来源，记录 `warning`。

## 8. 重复检测规则

重复检测分强匹配和弱匹配。

强匹配：

- `id` 完全一致。
- `sourcePrimary` 完全一致。
- external link URL 完全一致。

弱匹配：

- 标题完全一致。
- 候选标题命中现有作品 aliases。
- 候选 aliases 命中现有作品标题或 aliases。
- 同系列且年份相同或相邻。
- 标题标准化后相似。

第一版标题相似只做保守规则：

- 小写。
- 去掉空白和常见标点。
- 完全相等才算 `title_fuzzy`。

不引入复杂模糊搜索库，避免误判。

## 9. 冲突处理

每条 candidate 都可以选择动作。

### 9.1 创建

`create` 写入新作品。要求：

- candidate 没有 `error`。
- `id` 不与现有作品冲突。

### 9.2 跳过

`skip` 不写入作品表，只记录结果为 skipped。

### 9.3 覆盖

`overwrite` 用 candidate 的字段更新目标作品。

第一版覆盖只允许 owner/editor。
覆盖前记录 before/after 到 audit_logs。

### 9.4 合并

`merge` 用保守规则合并：

- 空字段可由 candidate 填充。
- `aliases`、`tags` 做去重追加。
- `summaryFull` 只有现有为空时填充。
- `recordStatus`、`visibility` 不自动提升，只在用户明确选择字段时更新。
- release/access/relation 第一版不自动合并，先记录为待处理。

### 9.5 待人工处理

`needs_review` 不允许执行写入。用户必须改成其他动作或跳过。

## 10. 自动备份

执行导入任务前必须备份。

备份流程：

```text
用户点击执行导入
  -> API 校验权限
  -> 确认 job 存在且有可执行 candidate
  -> 创建 SQLite 备份文件
  -> 写入 backup_snapshots
  -> 执行导入动作
  -> 写入 audit_logs 和 import job result
```

备份失败时，导入必须停止。

恢复设计：

- 第三阶段 UI 展示备份列表和文件路径。
- 恢复动作先不自动执行覆盖当前数据库。
- UI 提示用户手动关闭服务后替换数据库，或后续阶段增加安全恢复命令。

## 11. API 设计

新增后台 API：

```text
POST /api/admin/import-jobs/preview
GET  /api/admin/import-jobs
GET  /api/admin/import-jobs/:id
PATCH /api/admin/import-candidates/:id
POST /api/admin/import-jobs/:id/execute
GET  /api/admin/backups
```

权限：

- `editor` 和 `owner` 可以 preview、execute。
- `reviewer` 和 `viewer` 可以查看 import jobs，但不能执行。
- 只有 `owner` 可以查看备份详情中的完整文件路径。

错误：

- 401：未登录。
- 403：权限不足。
- 400：输入格式错误。
- 409：任务状态不允许执行或 candidate 有阻断错误。
- 500：备份或写入失败。

## 12. 后台 UI 设计

新增后台模块：“导入治理”。

也可以先替换现有作品页里的 ImportPanel，让导入体验从“单条即时写入”升级为“预览任务”。

页面结构：

```text
左侧：导入任务列表
  - 状态
  - 创建时间
  - 候选数量
  - 错误/警告数量

中间：候选项表格
  - 标题
  - proposed id
  - 状态
  - 重复匹配数
  - 当前动作

右侧：候选项详情
  - 解析字段
  - 预检问题
  - 重复匹配
  - 与目标作品字段对比
  - 动作选择
```

执行区：

- 显示将创建、覆盖、合并、跳过的数量。
- 显示即将创建备份。
- 执行按钮需要二次确认。

## 13. 审计与可追踪性

新增导入相关审计：

- `import_job.preview`
- `import_job.update_candidate`
- `import_job.execute`
- `backup.create`
- `work.import_create`
- `work.import_overwrite`
- `work.import_merge`
- `work.import_skip`

审计 actor 使用当前登录用户名。

import job 自身也记录汇总：

- 总候选数。
- 成功数。
- 跳过数。
- 失败数。
- 备份文件。

## 14. 测试策略

API 测试：

- preview 能解析多条 Markdown/YAML。
- YAML 错误生成 invalid candidate。
- 缺必填字段生成 issue。
- id/source/title/alias 重复检测正确。
- execute 前创建 backup。
- backup 失败时不写入作品。
- create/skip/overwrite/merge 动作结果正确。
- viewer 不能执行导入。
- audit_logs 记录 actor 和导入动作。

前端测试：

- 导入工作台能创建 preview job。
- candidate 表能显示 error/warning/match。
- 可修改 candidate 动作。
- 有阻断错误时执行按钮不可用。
- 执行成功后显示备份和导入结果。

手动验证：

- 使用 3 条 Markdown：1 条新作品、1 条重复 ID、1 条缺字段。
- 确认 preview 不写入 works。
- 调整动作后执行。
- 确认备份文件存在。
- 确认 audit logs 和 import job 结果正确。

## 15. 实施顺序

建议按以下顺序实施：

1. 增加 import job、candidate、issue、match、backup schema。
2. 抽离现有单条 Markdown 解析为可复用 parser。
3. 实现 preview service，只写 import tables，不写 works。
4. 实现 duplicate detection service。
5. 实现 backup service。
6. 实现 execute service，包括 create、skip、overwrite、merge。
7. 增加 admin import-governance routes。
8. 新增后台导入治理页面。
9. 替换旧 ImportPanel 的即时导入入口。
10. 补齐 API 和前端测试。
11. 跑通 `pnpm test`、`pnpm typecheck`、seed 和本地冒烟。

## 16. 验收标准

第三阶段完成时应满足：

- 可以一次预览多条 Markdown/YAML 候选作品。
- 预览阶段不会写入 works、releases、relations 等业务表。
- 每条候选项有清晰状态、问题列表、重复匹配和默认动作。
- 重复检测至少覆盖 id、标题、别名、sourcePrimary、external link URL。
- 执行导入前自动创建 SQLite 备份，备份失败则不写库。
- create、skip、overwrite、merge 四种动作都有后端测试覆盖。
- 导入执行和备份动作进入 audit_logs，并记录当前用户。
- 后台 UI 能完成 preview、查看问题、修改动作、执行导入、查看结果。
- viewer/reviewer 无法执行导入。
- `pnpm test` 和 `pnpm typecheck` 通过。

## 17. 后续扩展

第三阶段完成后可以继续考虑：

- 本地文件选择和拖拽导入。
- CSV/XLSX 导入映射。
- 更细的字段级 merge 选择 UI。
- 附件索引和封面本地化。
- 数据质量仪表盘整合 import issues 和 relation quality。
- 安全的一键恢复流程。
