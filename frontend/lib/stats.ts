import {
  ABANDONED_AFTER_DAYS,
  IDLE_CAP_SECONDS,
  LOTR_TRILOGY_SECONDS,
  SITTING_GAP_SECONDS,
  TTF_WINDOW_DAYS,
  type BookProgress,
  type BookRecord,
  type DayCell,
  type FingerprintTick,
  type HourCell,
  type PageVisit,
  type Payload,
  type Sitting,
  type Summary,
} from "./types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function isIdle(duration: number): boolean {
  return duration > IDLE_CAP_SECONDS;
}

export function zonedParts(ts: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(new Date(ts * 1000));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = get("weekday").slice(0, 3);
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    weekday: WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]),
  };
}

export function isoInZone(ts: number, timeZone: string): string {
  return new Date(ts * 1000)
    .toLocaleString("sv-SE", { timeZone, hour12: false })
    .replace(" ", "T");
}

export function weekStart(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

export function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(later: string, earlier: string): number {
  const toUtc = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year, (month ?? 1) - 1, day ?? 1);
  };
  return Math.round((toUtc(later) - toUtc(earlier)) / 86_400_000);
}

export function streakDays(active: Set<string>, today: string): number {
  if (active.size === 0) {
    return 0;
  }
  let cursor = active.has(today) ? today : shiftDate(today, -1);
  if (!active.has(cursor)) {
    return 0;
  }
  let streak = 0;
  while (active.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

export function stitchSittings(visits: PageVisit[]): Sitting[] {
  const byBook = new Map<number, PageVisit[]>();
  for (const visit of visits) {
    const list = byBook.get(visit.bookId) ?? [];
    list.push(visit);
    byBook.set(visit.bookId, list);
  }
  const sittings: Sitting[] = [];
  for (const [bookId, list] of byBook) {
    list.sort((a, b) => a.startTime - b.startTime || a.page - b.page);
    let startedAt = 0;
    let endedAt = 0;
    let activeSeconds = 0;
    let idleSeconds = 0;
    const pages = new Set<number>();
    const flush = () => {
      if (pages.size === 0) {
        return;
      }
      sittings.push({
        bookId,
        startedAt,
        endedAt,
        pages: pages.size,
        activeSeconds,
        idleSeconds,
      });
    };
    for (const visit of list) {
      const end = visit.startTime + Math.max(0, visit.duration);
      if (pages.size > 0 && visit.startTime - endedAt > SITTING_GAP_SECONDS) {
        flush();
        pages.clear();
        activeSeconds = 0;
        idleSeconds = 0;
      }
      if (pages.size === 0) {
        startedAt = visit.startTime;
      }
      endedAt = Math.max(endedAt, end);
      pages.add(visit.page);
      if (isIdle(visit.duration)) {
        idleSeconds += visit.duration;
      } else {
        activeSeconds += visit.duration;
      }
    }
    flush();
  }
  sittings.sort((a, b) => b.startedAt - a.startedAt);
  return sittings;
}

function emptyHours(): HourCell[] {
  const hours: HourCell[] = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      hours.push({ weekday, hour, activeSeconds: 0 });
    }
  }
  return hours;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((part / whole) * 1000) / 10);
}

function weightedPace(visits: PageVisit[], nowTs: number): number | null {
  let weighted = 0;
  let weights = 0;
  for (const visit of visits) {
    if (isIdle(visit.duration) || visit.duration <= 0) {
      continue;
    }
    const ageDays = Math.max(0, (nowTs - visit.startTime) / 86_400);
    if (ageDays > TTF_WINDOW_DAYS) {
      continue;
    }
    const weight = TTF_WINDOW_DAYS - ageDays + 1;
    weighted += visit.duration * weight;
    weights += weight;
  }
  if (weights === 0) {
    return null;
  }
  return weighted / weights;
}

function lifetimePace(visits: PageVisit[]): number | null {
  let seconds = 0;
  let count = 0;
  for (const visit of visits) {
    if (isIdle(visit.duration) || visit.duration <= 0) {
      continue;
    }
    seconds += visit.duration;
    count += 1;
  }
  if (count === 0) {
    return null;
  }
  return seconds / count;
}

export function equivalentLine(activeSeconds: number, idleSeconds: number): string {
  const active = Math.max(0, Math.round(activeSeconds));
  const idle = Math.max(0, Math.round(idleSeconds));
  const hours = active / 3600;
  const lot = hours / (LOTR_TRILOGY_SECONDS / 3600);
  let line =
    hours < 1
      ? `${Math.max(0, Math.round(active / 60))}m active`
      : `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hours active, about ${lot.toFixed(1)} times the Lord of the Rings trilogy`;
  if (idle > 0) {
    const idleHours = idle / 3600;
    const idleLabel =
      idleHours >= 1
        ? `${idleHours < 10 ? idleHours.toFixed(1) : Math.round(idleHours)}h parked`
        : `${Math.round(idle / 60)}m parked`;
    line = `${line}. ${idleLabel}.`;
  }
  return line;
}

export function emptyPayload(lastError: string): Payload {
  return {
    books: [],
    summary: {
      totalActiveSeconds: 0,
      totalIdleSeconds: 0,
      streakDays: 0,
      pagesThisWeek: 0,
      pagesThisMonth: 0,
      booksFinished: 0,
      lastSynced: null,
      stale: true,
      lastError,
      equivalentLine: equivalentLine(0, 0),
      nightOwlShare: 0,
    },
    days: [],
    hours: emptyHours(),
  };
}

export function buildDashboard(
  visits: PageVisit[],
  books: BookRecord[],
  timeZone: string,
  nowTs = Date.now() / 1000,
): Omit<Payload, "summary"> & { summary: Omit<Summary, "lastSynced" | "stale" | "lastError"> } {
  const today = zonedParts(nowTs, timeZone).date;
  const weekStartToday = weekStart(today);
  const monthStart = `${today.slice(0, 8)}01`;

  const latestPage = new Map<number, number>();
  const latestStart = new Map<number, number>();
  const uniquePages = new Map<number, Set<number>>();
  const byBook = new Map<number, PageVisit[]>();
  const ticks = new Map<number, Map<number, FingerprintTick>>();
  const daily = new Map<string, DayCell>();
  const dailyPages = new Map<string, Set<string>>();
  const hours = emptyHours();
  const weekPages = new Set<string>();
  const monthPages = new Set<string>();
  const activeDays = new Set<string>();
  let totalActive = 0;
  let totalIdle = 0;

  const hourIndex = (weekday: number, hour: number) => weekday * 24 + hour;

  for (const visit of visits) {
    const list = byBook.get(visit.bookId) ?? [];
    list.push(visit);
    byBook.set(visit.bookId, list);

    const prev = latestStart.get(visit.bookId);
    if (prev === undefined || visit.startTime >= prev) {
      latestStart.set(visit.bookId, visit.startTime);
      latestPage.set(visit.bookId, visit.page);
    }

    if (!uniquePages.has(visit.bookId)) {
      uniquePages.set(visit.bookId, new Set());
    }
    uniquePages.get(visit.bookId)?.add(visit.page);

    const bookTicks = ticks.get(visit.bookId) ?? new Map<number, FingerprintTick>();
    const tick = bookTicks.get(visit.page) ?? {
      page: visit.page,
      activeSeconds: 0,
      visits: 0,
    };
    tick.visits += 1;
    if (!isIdle(visit.duration)) {
      tick.activeSeconds += visit.duration;
    }
    bookTicks.set(visit.page, tick);
    ticks.set(visit.bookId, bookTicks);

    const { date, hour, weekday } = zonedParts(visit.startTime, timeZone);
    const cell = daily.get(date) ?? {
      date,
      activeSeconds: 0,
      idleSeconds: 0,
      pages: 0,
    };
    if (isIdle(visit.duration)) {
      cell.idleSeconds += visit.duration;
      totalIdle += visit.duration;
    } else {
      cell.activeSeconds += visit.duration;
      totalActive += visit.duration;
      if (weekday >= 0) {
        hours[hourIndex(weekday, hour)].activeSeconds += visit.duration;
      }
    }
    const dayKey = `${date}`;
    const seen = dailyPages.get(dayKey) ?? new Set<string>();
    seen.add(`${visit.bookId}:${visit.page}`);
    dailyPages.set(dayKey, seen);
    cell.pages = seen.size;
    daily.set(date, cell);

    if (visit.duration > 0 && !isIdle(visit.duration)) {
      activeDays.add(date);
    }

    const pageKey = `${visit.bookId}:${visit.page}`;
    if (date >= weekStartToday) {
      weekPages.add(pageKey);
    }
    if (date >= monthStart) {
      monthPages.add(pageKey);
    }
  }

  const sittings = stitchSittings(visits);
  const sittingsByBook = new Map<number, Sitting[]>();
  for (const sitting of sittings) {
    const list = sittingsByBook.get(sitting.bookId) ?? [];
    list.push(sitting);
    sittingsByBook.set(sitting.bookId, list);
  }

  let nightOwl = 0;
  for (const sitting of sittings) {
    const { hour } = zonedParts(sitting.startedAt, timeZone);
    if (hour >= 22 || hour < 5) {
      nightOwl += 1;
    }
  }

  const parsedBooks: BookProgress[] = [];
  let booksFinished = 0;
  for (const book of books) {
    const pages = book.pages;
    const currentPage = latestPage.get(book.id) ?? 0;
    const lastSession = latestStart.get(book.id);
    const lastReadTs = lastSession ?? book.lastOpen;
    const lastReadDate = lastReadTs == null ? null : zonedParts(lastReadTs, timeZone).date;
    const finished = pages > 0 && currentPage >= pages;
    if (finished) {
      booksFinished += 1;
    }
    const unique = uniquePages.get(book.id)?.size ?? 0;
    const progressPct = pct(currentPage, pages);
    const coveragePct = pct(unique, pages);
    const staleDays =
      lastReadDate == null ? Number.POSITIVE_INFINITY : daysBetween(today, lastReadDate);
    const abandoned =
      !finished &&
      staleDays >= ABANDONED_AFTER_DAYS &&
      progressPct >= 5 &&
      progressPct <= 90;
    const bookVisits = byBook.get(book.id) ?? [];
    const bookActive = bookVisits.reduce(
      (sum, visit) => sum + (isIdle(visit.duration) ? 0 : visit.duration),
      0,
    );
    const bookIdle = bookVisits.reduce(
      (sum, visit) => sum + (isIdle(visit.duration) ? visit.duration : 0),
      0,
    );
    const remaining = Math.max(0, pages - currentPage);
    const pace = weightedPace(bookVisits, nowTs) ?? lifetimePace(bookVisits);
    const ttfSeconds =
      !finished && remaining > 0 && pace != null ? Math.round(remaining * pace) : null;
    parsedBooks.push({
      id: book.id,
      title: book.title,
      authors: book.authors,
      pages,
      currentPage,
      uniquePages: unique,
      progressPct,
      coveragePct,
      lastRead: lastReadTs == null ? null : isoInZone(lastReadTs, timeZone),
      status: finished ? "finished" : "reading",
      abandoned,
      totalActiveSeconds: bookActive,
      totalIdleSeconds: bookIdle,
      ttfSeconds,
      fingerprint: [...(ticks.get(book.id)?.values() ?? [])].sort((a, b) => a.page - b.page),
      sittings: sittingsByBook.get(book.id) ?? [],
    });
  }

  return {
    books: parsedBooks,
    days: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    hours,
    summary: {
      totalActiveSeconds: totalActive,
      totalIdleSeconds: totalIdle,
      streakDays: streakDays(activeDays, today),
      pagesThisWeek: weekPages.size,
      pagesThisMonth: monthPages.size,
      booksFinished,
      equivalentLine: equivalentLine(totalActive, totalIdle),
      nightOwlShare: sittings.length === 0 ? 0 : nightOwl / sittings.length,
    },
  };
}

export function fillYear(days: DayCell[], today: string, span = 365): DayCell[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const result: DayCell[] = [];
  for (let i = span - 1; i >= 0; i -= 1) {
    const date = shiftDate(today, -i);
    result.push(
      byDate.get(date) ?? { date, activeSeconds: 0, idleSeconds: 0, pages: 0 },
    );
  }
  return result;
}
