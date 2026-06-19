# SAMDB Network UI Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the phase-2 SAMDB design: local users and role permissions, cleaner public/admin UI, richer work relation browsing, series views, and relation quality checks.

**Architecture:** Add local auth as API infrastructure first, then make admin routes depend on authenticated users and role checks. After the backend is protected, update the React shell and pages to expose public browsing, login/bootstrap flows, admin navigation, relation grouping, series views, and quality reports.

**Tech Stack:** Node.js `node:sqlite`, Hono, React 18, Vite, Vitest, Testing Library, TypeScript, local SQLite.

---

## File Structure

Backend files:

- `apps/api/src/schema.sql`: add `users` and `sessions`.
- `packages/shared/src/auth.ts`: shared role and permission definitions.
- `apps/api/src/services/users.ts`: user CRUD, password hashing, bootstrap checks.
- `apps/api/src/services/sessions.ts`: session creation, token hashing, lookup, expiry, logout.
- `apps/api/src/services/permissions.ts`: role permission checks for API.
- `apps/api/src/middleware/auth.ts`: Hono middleware for session and role enforcement.
- `apps/api/src/routes/auth.ts`: bootstrap, login, logout, me.
- `apps/api/src/routes/admin.ts`: protect routes and pass actor into audit logs.
- `apps/api/src/services/relations.ts`: reverse public relations, grouped relations, quality checks, series helpers.
- `apps/api/src/routes/public.ts`: expose series and grouped public relations.
- `apps/api/src/tests/auth-routes.test.ts`: auth route behavior.
- `apps/api/src/tests/admin-permissions.test.ts`: admin permission behavior.
- `apps/api/src/tests/relation-network.test.ts`: reverse relations, series, quality checks.

Frontend files:

- `apps/web/src/auth.ts`: token storage and auth helpers.
- `apps/web/src/api.ts`: authenticated requests, auth endpoints, series and quality endpoints.
- `apps/web/src/components/ui.tsx`: small Button, Field, Badge, Panel, EmptyState components.
- `apps/web/src/components/AppShell.tsx`: public/admin shell and account controls.
- `apps/web/src/pages/LoginPage.tsx`: login and bootstrap form.
- `apps/web/src/pages/AdminDashboardPage.tsx`: admin overview with module navigation.
- `apps/web/src/pages/AdminUsersPage.tsx`: local user management surface.
- `apps/web/src/pages/AdminRelationsPage.tsx`: relation maintenance and quality report.
- `apps/web/src/pages/SeriesPage.tsx`: public series list/detail.
- `apps/web/src/pages/WorkDetailPage.tsx`: grouped relation and series display.
- `apps/web/src/pages/WorksPage.tsx`: card/list density toggle.
- `apps/web/src/styles.css`: visual refresh and responsive layout.
- `apps/web/src/**/*.test.tsx`: frontend behavior tests for auth, shell, relation display, series, quality errors.

## Task 1: Shared Roles And Schema

**Files:**
- Create: `packages/shared/src/auth.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/schema.sql`
- Test: `packages/shared/src/tests/auth.test.ts`

- [x] **Step 1: Write the shared role test**

Create `packages/shared/src/tests/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canRole, roles } from "../auth";

describe("auth roles", () => {
  it("allows owners to manage users and viewers only to read admin data", () => {
    expect(roles).toContain("owner");
    expect(canRole("owner", "manage_users")).toBe(true);
    expect(canRole("viewer", "read_admin")).toBe(true);
    expect(canRole("viewer", "write_work")).toBe(false);
    expect(canRole("public", "read_admin")).toBe(false);
  });
});
```

- [x] **Step 2: Run the shared auth test and confirm it fails**

Run:

```powershell
pnpm --filter @samdb/shared test -- --run src/tests/auth.test.ts
```

Expected: fail because `../auth` does not exist.

- [x] **Step 3: Add shared auth definitions**

Create `packages/shared/src/auth.ts`:

```ts
export const roles = ["owner", "editor", "reviewer", "viewer", "public"] as const;
export type Role = typeof roles[number];

export const permissions = [
  "read_public",
  "read_admin",
  "write_work",
  "review_work",
  "import_export",
  "read_audit",
  "manage_users",
  "system_settings"
] as const;

export type Permission = typeof permissions[number];

const rolePermissions: Record<Role, Permission[]> = {
  owner: [...permissions],
  editor: ["read_public", "read_admin", "write_work", "import_export"],
  reviewer: ["read_public", "read_admin", "review_work", "read_audit"],
  viewer: ["read_public", "read_admin"],
  public: ["read_public"]
};

export function canRole(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function isRole(value: string): value is Role {
  return roles.includes(value as Role);
}
```

Modify `packages/shared/src/index.ts`:

```ts
export * from "./auth";
export * from "./enums";
export * from "./schemas";
export * from "./types";
export * from "./visibility";
```

- [x] **Step 4: Add users and sessions tables**

Modify `apps/api/src/schema.sql` by adding after `audit_logs`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
```

- [x] **Step 5: Run shared and API tests**

Run:

```powershell
pnpm --filter @samdb/shared test -- --run src/tests/auth.test.ts
pnpm --filter @samdb/api test -- --run src/tests/works-service.test.ts
```

Expected: both pass.

## Task 2: Auth Services And Routes

**Files:**
- Create: `apps/api/src/services/users.ts`
- Create: `apps/api/src/services/sessions.ts`
- Create: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/src/tests/auth-routes.test.ts`

- [x] **Step 1: Write failing auth route tests**

Create `apps/api/src/tests/auth-routes.test.ts` with tests for:

- `GET /bootstrap-status` returns `needsBootstrap: true` on empty DB.
- `POST /bootstrap` creates an owner and returns a token.
- second bootstrap returns 409.
- `POST /login` rejects wrong password with 401.
- `GET /me` returns the logged-in owner when `Authorization: Bearer <token>` is present.
- `POST /logout` invalidates the token.

- [x] **Step 2: Run auth route tests and confirm failure**

Run:

```powershell
pnpm --filter @samdb/api test -- --run src/tests/auth-routes.test.ts
```

Expected: fail because auth routes are missing.

- [x] **Step 3: Implement users service**

Create `apps/api/src/services/users.ts` with:

- `countUsers(db)`
- `createUser(db, payload)`
- `getUserByUsername(db, username)`
- `getUserById(db, id)`
- `verifyPassword(password, passwordHash)`
- `toPublicUser(row)`

Use `node:crypto` `scryptSync` with a random salt and store `scrypt:<salt>:<hash>`.

- [x] **Step 4: Implement sessions service**

Create `apps/api/src/services/sessions.ts` with:

- `createSession(db, userId)`
- `getSessionUser(db, token)`
- `deleteSession(db, token)`
- `hashToken(token)`

Use `randomBytes(32).toString("base64url")` for tokens and SHA-256 for token hash.

- [x] **Step 5: Implement auth routes and mount them**

Create `apps/api/src/routes/auth.ts` and mount in `apps/api/src/index.ts`:

```ts
app.route("/api/auth", createAuthApp(db));
```

- [x] **Step 6: Run auth route tests**

Run:

```powershell
pnpm --filter @samdb/api test -- --run src/tests/auth-routes.test.ts
```

Expected: pass.

## Task 3: Admin Permission Middleware And Audit Actor

**Files:**
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/services/permissions.ts`
- Modify: `apps/api/src/routes/admin.ts`
- Test: `apps/api/src/tests/admin-permissions.test.ts`
- Test: update `apps/api/src/tests/audit-logs.test.ts`

- [x] **Step 1: Write failing admin permission tests**

Create `apps/api/src/tests/admin-permissions.test.ts` with tests for:

- `GET /works` without token returns 401.
- viewer token can `GET /works`.
- viewer token cannot `POST /works` and receives 403.
- editor token can `POST /works`.
- reviewer token can patch status/visibility fields but cannot create work.
- owner can create another user through admin user route.

- [x] **Step 2: Update audit test to expect actor**

Modify `apps/api/src/tests/audit-logs.test.ts` so create/update calls use an authenticated editor token and expect audit `actor` to be that username.

- [x] **Step 3: Run tests and confirm failure**

Run:

```powershell
pnpm --filter @samdb/api test -- --run src/tests/admin-permissions.test.ts src/tests/audit-logs.test.ts
```

Expected: fail because admin routes are not protected and audit actor is not wired.

- [x] **Step 4: Implement middleware and permissions**

Create:

- `requireAuth(db)`
- `requirePermission(permission)`
- `getActor(c)`

The middleware should set `user` on Hono context.

- [x] **Step 5: Protect admin routes**

Modify `apps/api/src/routes/admin.ts`:

- apply `requireAuth(db)` to all admin routes.
- apply permission checks to mutating routes.
- allow reviewer only status/visibility review updates.
- pass actor into every `createAuditLog` call.
- add admin user list/create/update routes for owner.

- [x] **Step 6: Run permission and audit tests**

Run:

```powershell
pnpm --filter @samdb/api test -- --run src/tests/admin-permissions.test.ts src/tests/audit-logs.test.ts
```

Expected: pass.

## Task 4: Relation Network Services

**Files:**
- Modify: `apps/api/src/services/relations.ts`
- Modify: `apps/api/src/routes/public.ts`
- Modify: `apps/api/src/routes/admin.ts`
- Test: `apps/api/src/tests/relation-network.test.ts`

- [x] **Step 1: Write failing relation network tests**

Create tests proving:

- Public relation listing includes reverse derived relations.
- Public relation listing filters relations pointing to non-public works.
- Series summary combines `works.series`, `same_series`, `prequel`, and `sequel`.
- Quality report flags public relation to private work, missing weak relation note, and direction conflict.

- [x] **Step 2: Run relation tests and confirm failure**

Run:

```powershell
pnpm --filter @samdb/api test -- --run src/tests/relation-network.test.ts
```

Expected: fail because helpers/routes do not exist.

- [x] **Step 3: Implement relation helpers**

Add:

- `listPublicRelationNetworkForWork(db, workId)`
- `listSeriesSummaries(db)`
- `getSeriesDetail(db, seriesName)`
- `listRelationQualityIssues(db)`

- [x] **Step 4: Add routes**

Public:

- `GET /api/public/works/:id/relation-network`
- `GET /api/public/series`
- `GET /api/public/series/:name`

Admin:

- `GET /api/admin/relation-quality`

- [x] **Step 5: Run relation tests**

Run:

```powershell
pnpm --filter @samdb/api test -- --run src/tests/relation-network.test.ts
```

Expected: pass.

## Task 5: Frontend Auth And Shell

**Files:**
- Create: `apps/web/src/auth.ts`
- Create: `apps/web/src/pages/LoginPage.tsx`
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AppShell.tsx`
- Test: `apps/web/src/App.test.tsx`

- [x] **Step 1: Write failing frontend auth tests**

Tests should verify:

- When bootstrap is needed, admin navigation opens the owner setup form.
- When bootstrap is complete but no token exists, admin navigation opens login.
- After login, admin navigation shows admin shell.
- Viewer role does not see user-management navigation.

- [x] **Step 2: Run frontend auth test and confirm failure**

Run:

```powershell
pnpm --filter @samdb/web test -- --run src/App.test.tsx
```

Expected: fail because auth UI is missing.

- [x] **Step 3: Implement auth client and login/bootstrap page**

Add token helpers, auth API calls, and a combined login/bootstrap page.

- [x] **Step 4: Update App and AppShell**

Support pages:

- public works
- public series
- work detail
- admin dashboard
- login/bootstrap

- [x] **Step 5: Run frontend auth test**

Run:

```powershell
pnpm --filter @samdb/web test -- --run src/App.test.tsx
```

Expected: pass.

## Task 6: UI Component Refresh And Admin Navigation

**Files:**
- Create: `apps/web/src/components/ui.tsx`
- Create: `apps/web/src/pages/AdminDashboardPage.tsx`
- Create: `apps/web/src/pages/AdminUsersPage.tsx`
- Create: `apps/web/src/pages/AdminRelationsPage.tsx`
- Modify: `apps/web/src/pages/AdminWorksPage.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/pages/AdminDashboardPage.test.tsx`

- [x] **Step 1: Write failing admin UI tests**

Verify left navigation includes:

- 总览
- 作品
- 关系
- 分类
- 导入导出
- 用户与权限 for owner only
- 审计日志 for owner/reviewer
- 设置 for owner only

- [x] **Step 2: Run test and confirm failure**

Run:

```powershell
pnpm --filter @samdb/web test -- --run src/pages/AdminDashboardPage.test.tsx
```

Expected: fail because dashboard does not exist.

- [x] **Step 3: Implement UI components and admin dashboard**

Use a restrained, neutral visual system and avoid nested cards.

- [x] **Step 4: Update admin works layout**

Keep existing CRUD behavior while moving it into the new admin module shell.

- [x] **Step 5: Run admin UI tests**

Run:

```powershell
pnpm --filter @samdb/web test -- --run src/pages/AdminDashboardPage.test.tsx src/pages/AdminWorksPage.test.tsx
```

Expected: pass.

## Task 7: Public Relation And Series UI

**Files:**
- Create: `apps/web/src/pages/SeriesPage.tsx`
- Modify: `apps/web/src/pages/WorkDetailPage.tsx`
- Modify: `apps/web/src/pages/WorksPage.tsx`
- Modify: `apps/web/src/components/RelationList.tsx`
- Modify: `apps/web/src/api.ts`
- Test: `apps/web/src/pages/WorkDetailPage.test.tsx`
- Test: `apps/web/src/pages/SeriesPage.test.tsx`

- [x] **Step 1: Write failing public UI tests**

Verify:

- Work detail shows grouped relation sections.
- Reverse relation labels are human-readable.
- Series page lists series and opens a timeline-like detail.
- Works page toggles card/list density.

- [x] **Step 2: Run tests and confirm failure**

Run:

```powershell
pnpm --filter @samdb/web test -- --run src/pages/WorkDetailPage.test.tsx src/pages/SeriesPage.test.tsx
```

Expected: fail because new UI is missing.

- [x] **Step 3: Implement API client calls**

Add:

- `fetchPublicRelationNetwork`
- `fetchPublicSeries`
- `fetchPublicSeriesDetail`

- [x] **Step 4: Implement public UI**

Add grouped relations, series page, and density toggle.

- [x] **Step 5: Run public UI tests**

Run:

```powershell
pnpm --filter @samdb/web test -- --run src/pages/WorkDetailPage.test.tsx src/pages/SeriesPage.test.tsx
```

Expected: pass.

## Task 8: Final Verification

**Files:**
- No new source files.

- [x] **Step 1: Run all tests**

Run:

```powershell
pnpm test
```

Expected: all package tests pass.

- [x] **Step 2: Run typecheck**

Run:

```powershell
pnpm typecheck
```

Expected: all package typechecks pass.

- [x] **Step 3: Seed database**

Run:

```powershell
pnpm --filter @samdb/api seed
```

Expected: `Seed complete`.

- [x] **Step 4: Runtime smoke**

Start API and web on available local ports, then verify:

- `/health` returns `{ ok: true }`.
- `/api/auth/bootstrap-status` returns JSON.
- public works page loads.
- admin navigation requires login or bootstrap.
- after bootstrap/login, admin module navigation renders.

- [x] **Step 5: Requirement audit**

Re-read `docs/superpowers/specs/2026-06-18-samdb-network-ui-auth-design.md` and verify each acceptance criterion against code, tests, or runtime evidence.
