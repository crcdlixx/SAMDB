---
title: SAMDB 第二阶段设计：作品知识网络、简约 UI 与本地用户权限
created: 2026-06-18
status: implemented
scope: phase-2
depends_on:
  - docs/superpowers/specs/2026-06-07-samdb-local-design.md
---

# SAMDB 第二阶段设计：作品知识网络、简约 UI 与本地用户权限

## 1. 阶段目标

第二阶段把 SAMDB 从“可录入的本地作品元数据库”推进到“适合长期整理、浏览和维护的本地资料库系统”。

本阶段包含三条主线：

- 作品知识网络：把作品关系从后台维护项提升为公共浏览核心，让用户能顺着系列、前后作、改编、衍生、合集和版本关系继续探索。
- 简约 UI：重整公共端和后台的信息架构，形成干净、克制、资料馆气质的界面，而不是继续保持原型式堆叠。
- 本地用户权限：增加本地账号、登录、角色权限和用户审计，让后台写操作有边界、有责任归属。

系统仍然完全本地运行，数据库继续使用 SQLite。第二阶段不接入 Cloudflare、不使用 D1、不做云部署。

## 2. 非目标

第二阶段不实现以下内容：

- 云端部署、远程数据库、Cloudflare D1 或 Worker。
- 多组织、多租户、邀请协作、在线多人编辑。
- 复杂实时图谱引擎或大规模力导向关系图。
- 自动采集、自动审核、自动发布。
- 把星图 L1-L5 分类写回 `works` 主表。
- 完整设计系统站点或营销型首页。

星图分类继续通过 taxonomy 适配层表达；作品关系继续通过 `work_relations` 表达。两者保持分离。

## 3. 当前基础

第一阶段已经具备以下基础：

- 前后端分离：React/Vite 前端，Hono API 后端。
- 本地 SQLite 数据库。
- 作品、版本、获取方式、制作人员、封面、来源、外链、分类挂载、作品关系等核心模型。
- Markdown/YAML 导入导出。
- 后台写操作审计日志。
- 公共 API 对内部字段、草稿版本、内部关系做过滤。
- 公共检索支持标题、别名、标签和公开制作人员信息。

现有不足：

- UI 仍偏原型，公共端和后台边界不够清晰。
- 后台维护项较多，缺少清楚的信息架构。
- 作品关系虽然可录入，但公共呈现还不够像“作品地图”。
- 审计日志已有 actor 字段，但缺少真实用户模型。
- 后台 API 目前缺少登录和角色权限保护。

## 4. 总体架构

第二阶段仍采用本地三层结构：

```text
apps/web
  公共浏览界面
  后台管理界面
  登录与会话状态

apps/api
  public routes
  admin routes
  auth routes
  permission middleware
  audit service

SQLite
  现有作品数据表
  users / sessions / role checks
  relation quality views or query services
```

前端不直接访问 SQLite。所有权限判断以 API 为准，前端只做体验层面的显示和入口控制。

## 5. 作品知识网络设计

### 5.1 关系展示原则

作品关系不能只作为标签显示。它应当表达“两个作品之间为什么相关”，并服务于浏览路径。

公共端详情页新增“关联作品”区域，按语义分组展示：

- 系列关系：同系列、前作、续作。
- 改编关系：改编自、被改编为。
- 衍生关系：衍生作品、同人/二创基于。
- 版本关系：重制、高清修复、另版本、翻译/字幕版本。
- 收录关系：合集收录、被收录于。
- 弱关系：灵感来源、引用/致敬、泛关联。

每组展示目标作品标题、年份、简短摘要、关系说明和可见性允许的备注。

### 5.2 反向关系

后台可以只录入一条关系，但公共端需要能双向理解。

例如：

- A `prequel` B：A 页面显示“续作：B”，B 页面显示“前作：A”。
- A `adaptation_of` B：A 页面显示“改编自：B”，B 页面显示“被改编为：A”。
- A `same_series` B：两边都显示“同系列”。

反向关系不一定写入数据库，可以由服务层根据关系类型派生，避免数据重复。

### 5.3 系列视图

新增“系列视图”作为作品关系的聚合入口，不把 series 字段变成新的强绑定分类系统。

第一版系列视图可以从以下信息组合生成：

- `works.series`
- `work_relations.same_series`
- `prequel` / `sequel`
- taxonomy 中可选的系列类 term

系列视图展示：

- 系列名。
- 系列内作品列表。
- 按年份或手动排序的时间线。
- 当前作品在系列中的位置。
- 缺失或待确认关系提示。

### 5.4 关系质量检查

后台增加“关系检查”能力，帮助长期维护数据质量。

检查项：

- 重复关系：同一 source、target、relation_type 重复。
- 自指关系：作品指向自己。
- 互斥关系：同一对作品同时出现方向冲突的前作/续作。
- 非公开泄漏风险：公开关系指向非公开作品。
- 孤立弱关系：只有 `related` 且没有说明。
- 缺少说明的低置信关系。

质量检查先作为只读报告，不自动修改数据。

## 6. 简约 UI 设计

### 6.1 视觉方向

界面气质定位为“本地档案库 / 作品资料馆”：

- 简约、清楚、低装饰。
- 信息密度适中，适合反复整理和查阅。
- 不使用营销式大 hero。
- 不使用花哨渐变和强装饰背景。
- 色彩以中性色为主，少量强调色用于状态、焦点和危险操作。

### 6.2 公共端结构

公共端主导航：

- 作品
- 系列
- 分类
- 关于数据

作品列表支持两种密度：

- 卡片视图：适合浏览，展示标题、年份、摘要、标签、主封面。
- 紧凑列表：适合检索，展示标题、别名、年份、状态、主要分类。

作品详情页重排为：

- 标题区：标题、原名、年份、语言、状态、公开标签。
- 主信息区：封面、短摘要、长摘要。
- 关系区：关联作品、系列位置、改编链。
- 版本区：公开版本。
- 获取区：只展示允许公开的获取方式。
- 证据区：公开来源、外链、制作人员。

### 6.3 后台结构

后台从单页堆叠改为左侧导航布局：

- 总览
- 作品
- 关系
- 分类
- 导入导出
- 用户与权限
- 审计日志
- 设置

后台每个模块遵循同一模式：

- 顶部工具栏：搜索、筛选、新建。
- 主列表：可扫描、可排序。
- 右侧或详情页：编辑表单、关联维护、危险操作。
- 空状态：说明当前没有数据，并提供主要操作入口。
- 错误状态：显示可理解的错误原因和重试入口。

### 6.4 UI 组件规范

第二阶段沉淀一组轻量组件：

- `Button`：primary、secondary、ghost、danger。
- `Field`：统一 label、提示、错误。
- `Badge`：状态、可见性、角色、关系类型。
- `Panel`：页面分区，不做卡片嵌套。
- `DataList`：后台列表基础结构。
- `EmptyState`：空数据提示。
- `Toast` 或 `InlineNotice`：操作反馈。

这些组件只服务现有系统，不引入大型 UI 框架。

## 7. 本地用户与权限设计

### 7.1 用户模型

新增本地用户表：

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

新增会话表：

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

密码只保存哈希，不保存明文。会话 token 只在客户端保存原文，数据库保存 hash。

### 7.2 角色

角色从简开始：

- `owner`：最高权限；可管理用户、权限、设置和所有数据。
- `editor`：可创建、编辑、删除作品相关数据。
- `reviewer`：可审核、改状态、查看审计和质量检查。
- `viewer`：可进入后台查看允许的数据，不能写入。
- `public`：未登录访问者，只能访问公共 API。

### 7.3 权限矩阵

```text
能力                     owner  editor  reviewer  viewer  public
查看公共作品             yes    yes     yes       yes     yes
查看后台作品             yes    yes     yes       yes     no
创建/编辑作品            yes    yes     no        no      no
删除作品                 yes    yes     no        no      no
维护版本/获取/封面        yes    yes     no        no      no
维护分类和关系            yes    yes     no        no      no
审核状态和可见性          yes    no      yes       no      no
导入导出                 yes    yes     no        no      no
查看审计日志             yes    no      yes       no      no
管理用户                 yes    no      no        no      no
系统设置                 yes    no      no        no      no
```

如果后续需要更细粒度权限，可以再从 role 扩展为 permission 表。第二阶段不先做复杂权限表。

### 7.4 初次启动

系统启动时如果没有任何用户：

- API 提供一次性初始化入口。
- 前端显示创建 owner 账号页面。
- 创建成功后关闭初始化入口。

如果已有用户，后台入口要求登录。

### 7.5 API 保护

新增 auth routes：

- `POST /api/auth/bootstrap`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

后台 routes 增加权限中间件：

- 未登录请求返回 401。
- 角色不足返回 403。
- 公共 routes 不需要登录，但继续做公开字段过滤。

### 7.6 审计日志

审计日志的 `actor` 字段改为当前登录用户的 username 或 user id。

审计内容继续记录：

- entity type
- entity id
- action
- actor
- before_json
- after_json
- created_at

用户登录、登出、创建用户、禁用用户、修改角色也进入审计。

## 8. 数据流

### 8.1 登录数据流

```text
用户提交用户名和密码
  -> API 校验用户是否存在、是否启用、密码是否匹配
  -> 创建 session
  -> 返回 token 和当前用户信息
  -> 前端保存 token
  -> 后续后台请求携带 Authorization header
```

### 8.2 后台写操作数据流

```text
前端提交写操作
  -> auth middleware 校验 session
  -> permission middleware 校验角色
  -> route 调用 service
  -> service 写入 SQLite
  -> audit service 记录 actor、before、after
  -> 前端显示操作结果
```

### 8.3 公共关系展示数据流

```text
打开作品详情
  -> 获取公开作品详情
  -> 获取公开关系列表
  -> 服务层补齐反向关系
  -> 过滤非公开目标作品
  -> 前端按关系组渲染
```

## 9. 错误处理

权限相关：

- 401：未登录或会话过期，前端跳转登录。
- 403：角色无权限，前端显示权限不足。
- 409：初始化已完成、用户名已存在、关系重复等冲突。

关系相关：

- 指向不存在作品时返回 400。
- 指向非公开作品但关系设置为 public 时返回 400 或在质量检查中提示。
- 自指关系返回 400。

导入导出相关：

- 导入时遇到权限不足直接阻止。
- 导入成功后记录导入用户和导入结果。

## 10. 测试策略

API 测试：

- 用户 bootstrap、登录、登出、me。
- 密码错误、禁用用户、过期 session。
- admin routes 未登录返回 401。
- editor 可以写作品，viewer 不能写作品。
- reviewer 可以审核状态，不能维护用户。
- 审计日志记录真实 actor。
- 公共关系不会泄漏非公开作品。
- 反向关系派生正确。

前端测试：

- 未登录访问后台显示登录页。
- 不同角色看到不同后台入口。
- 权限不足时显示错误。
- 作品详情页按关系分组渲染。
- 空关系、空系列、无封面时界面稳定。

手动验证：

- 初始化 owner。
- 登录后台。
- 创建作品关系。
- 在公共详情页查看正向与反向关系。
- 切换不同角色验证后台入口。

## 11. 实施顺序

建议按以下顺序实施：

1. 数据库增加 `users` 和 `sessions`。
2. 实现 auth service、session service、权限中间件。
3. 保护 admin API，并把审计 actor 接入当前用户。
4. 增加登录页、初始化 owner 页面和前端 auth 状态。
5. 重构 AppShell，区分公共端和后台端。
6. 重整后台左侧导航与模块布局。
7. 升级公共作品详情页的关系展示。
8. 实现反向关系派生和系列视图。
9. 增加关系质量检查页面。
10. 跑通测试、类型检查、seed 和本地手动验证。

## 12. 验收标准

第二阶段完成时应满足：

- 没有 owner 时可以初始化本地管理员。
- 已有用户时后台必须登录。
- 后台写操作全部受角色权限控制。
- 审计日志能记录真实用户。
- 公共端不泄漏受限字段和非公开关系目标。
- 作品详情页能清楚展示关联作品、系列位置和改编链。
- 后台 UI 从单页堆叠改为清晰模块导航。
- 核心页面在桌面和移动宽度下不出现明显重叠、溢出或布局跳动。
- `pnpm test` 和 `pnpm typecheck` 通过。

## 13. 后续扩展

第二阶段完成后，可以继续考虑：

- 静态公开站导出。
- 本地数据库备份和恢复。
- 更细粒度 permission 表。
- 图谱式可视化浏览。
- 批量导入预览和重复检测。
- 更完整的数据质量仪表盘。
