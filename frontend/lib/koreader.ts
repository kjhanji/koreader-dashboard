import { readFileSync } from "fs";
import { join } from "path";
import initSqlJs, { type Database } from "sql.js";
import { buildDashboard, emptyPayload, isoInZone } from "./stats";
import type { BookRecord, PageVisit, Payload } from "./types";

type CacheEntry = {
  at: number;
  payload: Payload;
};

let cache: CacheEntry | null = null;

function loadParentEnv() {
  const envPath = join(process.cwd(), "..", ".env");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq < 1) {
        continue;
      }
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Vercel has no parent .env; project env vars are used instead.
  }
}

function settings() {
  loadParentEnv();
  const base = (process.env.WEBDAV_URL ?? "https://app.koofr.net/dav/Koofr").replace(
    /\/$/,
    "",
  );
  let path = process.env.KOREADER_DB_PATH ?? "/readingStats/statistics.sqlite3";
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  return {
    url: `${base}${path}`,
    username: process.env.WEBDAV_USERNAME ?? "",
    password: process.env.WEBDAV_PASSWORD ?? "",
    timezone: process.env.TIMEZONE ?? "America/Los_Angeles",
    ttlMs: Number(process.env.CACHE_TTL_SECONDS ?? 30) * 1000,
  };
}

function tableColumns(db: Database, table: string): Set<string> {
  const result = db.exec(`PRAGMA table_info(${table})`);
  if (!result[0]) {
    throw new Error(`Missing table: ${table}`);
  }
  const nameIndex = result[0].columns.indexOf("name");
  return new Set(result[0].values.map((row) => String(row[nameIndex])));
}

function verifySchema(db: Database) {
  const required: Record<string, string[]> = {
    book: ["id", "title", "authors", "pages", "last_open"],
    page_stat_data: ["id_book", "page", "start_time", "duration"],
  };
  for (const [table, cols] of Object.entries(required)) {
    const have = tableColumns(db, table);
    const missing = cols.filter((col) => !have.has(col));
    if (missing.length) {
      throw new Error(`Table ${table} is missing columns: ${missing.join(", ")}`);
    }
  }
}

function rows(db: Database, sql: string): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  const out: Record<string, unknown>[] = [];
  while (stmt.step()) {
    out.push(stmt.getAsObject());
  }
  stmt.free();
  return out;
}

async function parseWithSql(bytes: Uint8Array, timezone: string): Promise<Payload> {
  const wasmPath = join(process.cwd(), "vendor/sql-wasm.wasm");
  const wasmBinary = new Uint8Array(readFileSync(wasmPath));
  const SQL = await initSqlJs({
    wasmBinary: wasmBinary.buffer as ArrayBuffer,
  });
  const db = new SQL.Database(bytes);
  try {
    verifySchema(db);
    const bookRows = rows(
      db,
      "SELECT id, title, authors, pages, last_open FROM book ORDER BY last_open DESC",
    );
    const pageRows = rows(
      db,
      "SELECT id_book, page, start_time, duration FROM page_stat_data ORDER BY start_time ASC",
    );
    const books: BookRecord[] = bookRows.map((row) => ({
      id: Number(row.id),
      title: row.title == null ? null : String(row.title),
      authors: row.authors == null ? null : String(row.authors),
      pages: Number(row.pages ?? 0),
      lastOpen: row.last_open == null ? null : Number(row.last_open),
    }));
    const visits: PageVisit[] = pageRows.map((row) => ({
      bookId: Number(row.id_book),
      page: Number(row.page ?? 0),
      startTime: Number(row.start_time ?? 0),
      duration: Number(row.duration ?? 0),
    }));
    const built = buildDashboard(visits, books, timezone);
    const generatedAt = isoInZone(Date.now() / 1000, timezone);
    return {
      books: built.books,
      days: built.days,
      hours: built.hours,
      summary: {
        ...built.summary,
        lastSynced: generatedAt,
        stale: false,
        lastError: null,
      },
    };
  } finally {
    db.close();
  }
}

export async function loadStats(): Promise<Payload> {
  const cfg = settings();
  const now = Date.now();
  if (cache && now - cache.at < cfg.ttlMs && !cache.payload.summary.stale) {
    return cache.payload;
  }
  if (!cfg.username || !cfg.password) {
    return emptyPayload("WEBDAV_USERNAME and WEBDAV_PASSWORD are required");
  }
  try {
    const response = await fetch(cfg.url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64")}`,
      },
      cache: "no-store",
    });
    if (response.status === 404) {
      throw new Error(`File not found at ${cfg.url}`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("WebDAV rejected the credentials");
    }
    if (!response.ok) {
      throw new Error(`WebDAV returned HTTP ${response.status}`);
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    const payload = await parseWithSql(buffer, cfg.timezone);
    cache = { at: now, payload };
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load stats";
    if (cache) {
      return {
        ...cache.payload,
        summary: { ...cache.payload.summary, stale: true, lastError: message },
      };
    }
    return emptyPayload(message);
  }
}
