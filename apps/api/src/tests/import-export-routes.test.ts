import { describe, expect, it } from "vitest";
import { createMemoryDatabase } from "../db";
import { createAdminApp } from "../routes/admin";
import { bootstrapOwnerToken, jsonHeaders } from "./authTestHelpers";

describe("import/export admin routes", () => {
  it("imports a work from markdown through the admin API", async () => {
    const db = createMemoryDatabase();
    const app = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);
    const markdown = `---
id: route-imported-work
title: 路由导入作品
summaryShort: 通过路由导入。
sourcePrimary: https://example.test/route-imported
recordStatus: published
visibility: public
---

# 路由导入作品
`;

    const response = await app.request("/import", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ markdown })
    });
    const body = await response.json() as { id: string; title: string };

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      id: "route-imported-work",
      title: "路由导入作品"
    });
  });

  it("rejects import requests without markdown", async () => {
    const db = createMemoryDatabase();
    const app = createAdminApp(db);
    const token = await bootstrapOwnerToken(db);

    const response = await app.request("/import", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({})
    });

    expect(response.status).toBe(400);
  });
});
