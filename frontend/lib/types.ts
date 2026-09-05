export type BookStatus = "reading" | "finished";

export type Book = {
  id: number;
  title: string | null;
  authors: string | null;
  pages: number;
  current_page: number;
  progress_pct: number;
  last_read: string | null;
  status: BookStatus;
};

export type DailyPoint = {
  date: string;
  seconds: number;
};

export type WeeklyPoint = {
  week_start: string;
  seconds: number;
};

export type Summary = {
  total_reading_seconds: number;
  streak_days: number;
  pages_this_week: number;
  pages_this_month: number;
  books_finished: number;
  daily: DailyPoint[];
  weekly: WeeklyPoint[];
  last_synced: string | null;
  stale: boolean;
  last_error: string | null;
};
