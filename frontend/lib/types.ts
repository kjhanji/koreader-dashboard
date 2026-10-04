export const IDLE_CAP_SECONDS = 300;
export const SITTING_GAP_SECONDS = 15 * 60;
export const ABANDONED_AFTER_DAYS = 21;
export const TTF_WINDOW_DAYS = 14;
export const LOTR_TRILOGY_SECONDS = 55 * 3600;

export type BookStatus = "reading" | "finished";

export type PageVisit = {
  bookId: number;
  page: number;
  startTime: number;
  duration: number;
};

export type Sitting = {
  bookId: number;
  startedAt: number;
  endedAt: number;
  pages: number;
  activeSeconds: number;
  idleSeconds: number;
};

export type DayCell = {
  date: string;
  activeSeconds: number;
  idleSeconds: number;
  pages: number;
};

export type HourCell = {
  weekday: number;
  hour: number;
  activeSeconds: number;
};

export type FingerprintTick = {
  page: number;
  activeSeconds: number;
  visits: number;
};

export type BookProgress = {
  id: number;
  title: string | null;
  authors: string | null;
  pages: number;
  currentPage: number;
  uniquePages: number;
  progressPct: number;
  coveragePct: number;
  lastRead: string | null;
  status: BookStatus;
  abandoned: boolean;
  totalActiveSeconds: number;
  totalIdleSeconds: number;
  ttfSeconds: number | null;
  fingerprint: FingerprintTick[];
  sittings: Sitting[];
};

export type Summary = {
  totalActiveSeconds: number;
  totalIdleSeconds: number;
  streakDays: number;
  pagesThisWeek: number;
  pagesThisMonth: number;
  booksFinished: number;
  lastSynced: string | null;
  stale: boolean;
  lastError: string | null;
  equivalentLine: string;
  nightOwlShare: number;
};

export type Payload = {
  books: BookProgress[];
  summary: Summary;
  days: DayCell[];
  hours: HourCell[];
};

export type BookRecord = {
  id: number;
  title: string | null;
  authors: string | null;
  pages: number;
  lastOpen: number | null;
};
