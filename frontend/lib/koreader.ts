import { readFileSync } from "fs";
import { join } from "path";
import initSqlJs, { type Database } from "sql.js";
import type { Book, Summary } from "./types";

export type Payload = {
  books: Book[];
  summary: Summary;
};

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

function emptyPayload(lastError: string): Payload {
  return {
    books: [],
    summary: {
      total_reading_seconds: 0,
      streak_days: 0,
      pages_this_week: 0,
      pages_this_month: 0,
      books_finished: 0,
      daily: [],
      weekly: [],
      last_synced: null,
      stale: true,
      last_error: lastError,
    },
  };
}

function localDate(ts: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts * 1000));
}

function isoInZone(ts: number, timeZone: string): string {
  return new Date(ts * 1000)
    .toLocaleString("sv-SE", { timeZone, hour12: false })
    .replace(" ", "T");
}

function weekStart(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function streakDays(active: Set<string>, today: string): number {
  if (active.size === 0) {
    return 0;
  }
  const shift = (iso: string, days: number) => {
    const [year, month, day] = iso.split("-").map(Number);
    const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  let cursor = active.has(today) ? today : shift(today, -1);
  if (!active.has(cursor)) {
    return 0;
  }
  let streak = 0;
  while (active.has(cursor)) {
    streak += 1;
    cursor = shift(cursor, -1);
  }
  return streak;
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
    const books = rows(
      db,
      "SELECT id, title, authors, pages, last_open FROM book ORDER BY last_open DESC",
    );
    const pageRows = rows(
      db,
      "SELECT id_book, page, start_time, duration FROM page_stat_data ORDER BY start_time ASC",
    );

    const today = localDate(Date.now() / 1000, timezone);
    const weekStartToday = weekStart(today);
    const monthStart = `${today.slice(0, 8)}01`;

    const latestPage = new Map<number, number>();
    const latestStart = new Map<number, number>();
    const totals = new Map<number, number>();
    const uniquePages = new Map<number, Set<number>>();
    const dailyAll = new Map<string, number>();
    const active = new Set<string>();
    let pagesThisWeek = 0;
    let pagesThisMonth = 0;

    for (const row of pageRows) {
      const bookId = Number(row.id_book);
      const page = Number(row.page ?? 0);
      const startTime = Number(row.start_time ?? 0);
      const duration = Number(row.duration ?? 0);
      const day = localDate(startTime, timezone);
      const prev = latestStart.get(bookId);
      if (prev === undefined || startTime >= prev) {
        latestStart.set(bookId, startTime);
        latestPage.set(bookId, page);
      }
      totals.set(bookId, (totals.get(bookId) ?? 0) + duration);
      if (!uniquePages.has(bookId)) {
        uniquePages.set(bookId, new Set());
      }
      uniquePages.get(bookId)?.add(page);
      dailyAll.set(day, (dailyAll.get(day) ?? 0) + duration);
      if (duration > 0) {
        active.add(day);
      }
      if (day >= weekStartToday) {
        pagesThisWeek += 1;
      }
      if (day >= monthStart) {
        pagesThisMonth += 1;
      }
    }

    const parsedBooks: Book[] = [];
    let booksFinished = 0;
    for (const book of books) {
      const id = Number(book.id);
      const pages = Number(book.pages ?? 0);
      const currentPage = latestPage.get(id) ?? 0;
      const lastSession = latestStart.get(id);
      const lastOpen = book.last_open == null ? null : Number(book.last_open);
      const lastReadTs = lastSession ?? lastOpen;
      const finished = pages > 0 && currentPage >= pages;
      if (finished) {
        booksFinished += 1;
      }
      parsedBooks.push({
        id,
        title: book.title == null ? null : String(book.title),
        authors: book.authors == null ? null : String(book.authors),
        pages,
        current_page: currentPage,
        progress_pct: pages > 0 ? Math.min(100, Math.round((currentPage / pages) * 1000) / 10) : 0,
        last_read: lastReadTs == null ? null : isoInZone(lastReadTs, timezone),
        status: finished ? "finished" : "reading",
      });
    }

    const daily = [...dailyAll.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, seconds]) => ({ date, seconds }));
    const weeklyMap = new Map<string, number>();
    for (const [date, seconds] of dailyAll) {
      const start = weekStart(date);
      weeklyMap.set(start, (weeklyMap.get(start) ?? 0) + seconds);
    }
    const weekly = [...weeklyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week_start, seconds]) => ({ week_start, seconds }));

    const generatedAt = isoInZone(Date.now() / 1000, timezone);
    const totalSeconds = [...totals.values()].reduce((sum, value) => sum + value, 0);
    return {
      books: parsedBooks,
      summary: {
        total_reading_seconds: totalSeconds,
        streak_days: streakDays(active, today),
        pages_this_week: pagesThisWeek,
        pages_this_month: pagesThisMonth,
        books_finished: booksFinished,
        daily,
        weekly,
        last_synced: generatedAt,
        stale: false,
        last_error: null,
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
        books: cache.payload.books,
        summary: { ...cache.payload.summary, stale: true, last_error: message },
      };
    }
    return emptyPayload(message);
  }
}
