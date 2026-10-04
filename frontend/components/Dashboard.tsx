"use client";

import { useMemo, useState } from "react";
import { BookSheet } from "@/components/BookSheet";
import { HourGrid } from "@/components/HourGrid";
import { YearHeatmap } from "@/components/YearHeatmap";
import { formatDate, formatDuration, pagesLeft, shortDate } from "@/lib/format";
import { zonedParts } from "@/lib/stats";
import type { BookProgress, Payload } from "@/lib/types";

export function Dashboard({
  payload,
  timeZone,
}: {
  payload: Payload;
  timeZone: string;
}) {
  const { books, summary } = payload;
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const reading = useMemo(
    () =>
      books
        .filter((book) => book.status === "reading" && !book.abandoned)
        .sort((a, b) => (b.lastRead ?? "").localeCompare(a.lastRead ?? "")),
    [books],
  );
  const abandoned = useMemo(
    () =>
      books
        .filter((book) => book.abandoned)
        .sort((a, b) => (b.lastRead ?? "").localeCompare(a.lastRead ?? "")),
    [books],
  );
  const finished = useMemo(
    () =>
      books
        .filter((book) => book.status === "finished")
        .sort((a, b) => (b.lastRead ?? "").localeCompare(a.lastRead ?? "")),
    [books],
  );
  const nowReading = reading[0] ?? null;
  const selected = books.find((book) => book.id === selectedId) ?? null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-8 flex items-baseline justify-between gap-4 text-[13px] text-[var(--muted)]">
        <span className="text-[var(--ink)]">Reading</span>
        <span>{summary.lastSynced ? `Synced ${formatDate(summary.lastSynced)}` : "Not synced"}</span>
      </header>

      {summary.stale || summary.lastError ? (
        <div className="mb-6 rounded-[var(--radius-sm)] border border-[var(--warn)]/40 bg-[var(--elev)] px-4 py-3 text-sm text-[var(--warn)]">
          {summary.stale
            ? "Showing last known stats. The latest file from Koofr could not be loaded."
            : null}
          {summary.lastError ? (
            <div className="mt-1 text-[var(--muted)]">{summary.lastError}</div>
          ) : null}
        </div>
      ) : null}

      {nowReading ? (
        <button
          type="button"
          className="press mb-6 block w-full text-left"
          onClick={() => setSelectedId(nowReading.id)}
        >
          <p className="text-[13px] text-[var(--muted)]">Now reading</p>
          <h1 className="font-title mt-1 text-4xl leading-[1.1] tracking-tight sm:text-5xl">
            {nowReading.title ?? "Untitled"}
          </h1>
          <p className="mt-1 text-[var(--muted)]">{nowReading.authors ?? "Unknown author"}</p>
          <p className="num mt-3 text-sm text-[var(--muted)]">
            {nowLine(nowReading, timeZone)}
          </p>
        </button>
      ) : (
        <section className="mb-6">
          <h1 className="font-title text-4xl tracking-tight">Reading</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Nothing in progress. Open a book on the Kindle and sync.
          </p>
        </section>
      )}

      <section className="mb-3 grid grid-cols-2 border-y border-[var(--rule)] sm:grid-cols-4">
        <Metric label="Streak" value={`${summary.streakDays}d`} />
        <Metric label="This week" value={`${summary.pagesThisWeek} pp`} />
        <Metric label="This month" value={`${summary.pagesThisMonth} pp`} />
        <Metric label="Finished" value={String(summary.booksFinished)} />
      </section>
      <p className="mb-8 text-[13px] text-[var(--muted)]">
        {summary.equivalentLine}
        {summary.nightOwlShare >= 0.3
          ? ` ${Math.round(summary.nightOwlShare * 100)}% of sittings start after 10pm.`
          : null}
      </p>

      <div className="mb-8">
        <YearHeatmap days={payload.days} timeZone={timeZone} />
      </div>
      <div className="mb-10">
        <HourGrid hours={payload.hours} />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-1 text-[13px] font-medium text-[var(--muted)]">Currently reading</h2>
          {reading.length === 0 ? (
            <p className="py-4 text-sm text-[var(--muted)]">Nothing in progress.</p>
          ) : (
            <ul>
              {reading.map((book) => (
                <BookRow key={book.id} book={book} onOpen={setSelectedId} />
              ))}
            </ul>
          )}
          {abandoned.length > 0 ? (
            <div className="mt-8">
              <h2 className="mb-1 text-[13px] font-medium text-[var(--muted)]">Abandoned</h2>
              <ul className="opacity-70">
                {abandoned.map((book) => (
                  <BookRow key={book.id} book={book} onOpen={setSelectedId} compact />
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section>
          <h2 className="mb-1 text-[13px] font-medium text-[var(--muted)]">Finished</h2>
          {finished.length === 0 ? (
            <p className="py-4 text-sm text-[var(--muted)]">No finished books yet.</p>
          ) : (
            <ul>
              {finished.map((book) => (
                <BookRow key={book.id} book={book} onOpen={setSelectedId} compact />
              ))}
            </ul>
          )}
        </section>
      </div>

      {selected ? (
        <BookSheet book={selected} timeZone={timeZone} onClose={() => setSelectedId(null)} />
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-[var(--rule)] px-0 py-3 sm:px-4 sm:[&:not(:first-child)]:border-l max-sm:odd:pr-4 max-sm:even:border-l max-sm:even:pl-4">
      <div className="text-[12px] text-[var(--muted)]">{label}</div>
      <div className="num mt-1 text-2xl tracking-tight">{value}</div>
    </div>
  );
}

function BookRow({
  book,
  onOpen,
  compact = false,
}: {
  book: BookProgress;
  onOpen: (id: number) => void;
  compact?: boolean;
}) {
  return (
    <li className="border-t border-[var(--rule)] first:border-t-0">
      <button
        type="button"
        onClick={() => onOpen(book.id)}
        className="press pressable-row flex w-full flex-col py-3 text-left"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className={`font-title leading-snug ${compact ? "text-base" : "text-xl"}`}>
            {book.title ?? "Untitled"}
          </span>
          <span className="num shrink-0 text-sm text-[var(--muted)]">
            {book.status === "finished"
              ? formatDate(book.lastRead)
              : `${book.currentPage}/${book.pages}`}
          </span>
        </div>
        {book.status === "reading" && !compact ? (
          <>
            <div className="progress-track mt-3">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(100, book.progressPct)}%` }}
              />
            </div>
            <div className="num mt-1 text-xs text-[var(--muted)]">
              {book.progressPct.toFixed(1)}% · last read {formatDate(book.lastRead)}
            </div>
          </>
        ) : null}
        {compact && book.status === "reading" ? (
          <div className="num mt-1 text-xs text-[var(--muted)]">
            last read {formatDate(book.lastRead)}
          </div>
        ) : null}
      </button>
    </li>
  );
}

function nowLine(book: BookProgress, timeZone: string): string {
  const left = pagesLeft(book.pages, book.currentPage);
  const parts = [`${left} pages left`];
  if (book.ttfSeconds != null) {
    parts.push(`about ${formatDuration(book.ttfSeconds)} at your recent pace`);
  }
  const last = book.sittings.find((sitting) => sitting.activeSeconds > 0);
  if (last) {
    const day = zonedParts(last.startedAt, timeZone).date;
    parts.push(`last sitting ${shortDate(day)}, ${formatDuration(last.activeSeconds)}`);
  }
  return parts.join(" · ");
}
