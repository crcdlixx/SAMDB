import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

type SqliteStatement = {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
};

export type SamDb = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
};

const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => SamDb;
};

export function createDatabase(path = resolve(__dirname, "../../../../data/samdb.sqlite")): SamDb {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

export function initializeDatabase(db: SamDb): void {
  const schema = readFileSync(resolve(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
}

export function createMemoryDatabase(): SamDb {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  initializeDatabase(db);
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}
