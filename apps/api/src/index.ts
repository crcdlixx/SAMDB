import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDatabase, initializeDatabase } from "./db";
import { createAdminApp } from "./routes/admin";
import { createAuthApp } from "./routes/auth";
import { createPublicApp } from "./routes/public";

const db = createDatabase(process.env.SAMDB_DATABASE_PATH);
initializeDatabase(db);

const app = new Hono();
app.use("*", cors());
app.route("/api/auth", createAuthApp(db));
app.route("/api/public", createPublicApp(db));
app.route("/api/admin", createAdminApp(db));

app.get("/health", (c) => c.json({ ok: true }));

const port = Number(process.env.SAMDB_API_PORT ?? 8791);
serve({ fetch: app.fetch, port });

console.log(`SAMDB API listening on http://localhost:${port}`);
