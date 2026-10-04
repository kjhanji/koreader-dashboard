"use client";

import { useEffect } from "react";
import { Fingerprint } from "@/components/Fingerprint";
import { formatDate, formatDuration } from "@/lib/format";
import { isoInZone } from "@/lib/stats";
import type { BookProgress } from "@/lib/types";

export function BookSheet({
  book,
  timeZone,
  onClose,
}: {
  book: BookProgress;
  timeZone: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sittings = book.sittings.slice(0, 10);

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close book"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-sheet-title"
        className="relative z-10 max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-[var(--radius)] border border-[var(--rule)] bg-[var(--elev)] p-5 sm:rounded-[var(--radius)] sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="book-sheet-title" className="font-title text-3xl leading-tight">
              {book.title ?? "Untitled"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{book.authors ?? "Unknown author"}</p>
          </div>
          <button type="button" className="press text-sm text-[var(--muted)]" onClick={onClose}>
            Close
          </button>
        </div>

        <dl className="mb-5 grid grid-cols-2 gap-4 border-y border-[var(--rule)] py-4 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Recency</dt>
            <dd className="num mt-1 text-xl">{book.progressPct.toFixed(1)}%</dd>
            <dd className="mt-1 text-[var(--muted)]">
              Latest session on page {book.currentPage} of {book.pages}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Coverage</dt>
            <dd className="num mt-1 text-xl">{book.coveragePct.toFixed(1)}%</dd>
            <dd className="mt-1 text-[var(--muted)]">
              {book.uniquePages} distinct pages visited
            </dd>
          </div>
        </dl>

        <h3 className="mb-2 text-[13px] font-medium text-[var(--muted)]">Pages</h3>
        <Fingerprint pages={book.pages} ticks={book.fingerprint} />

        <h3 className="mb-2 mt-6 text-[13px] font-medium text-[var(--muted)]">Sittings</h3>
        {sittings.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No sittings recorded.</p>
        ) : (
          <ul>
            {sittings.map((sitting) => {
              const started = isoInZone(sitting.startedAt, timeZone);
              const time = started.slice(11, 16);
              const duration =
                sitting.activeSeconds > 0
                  ? formatDuration(sitting.activeSeconds)
                  : `${formatDuration(sitting.idleSeconds)} parked`;
              return (
                <li
                  key={`${sitting.bookId}-${sitting.startedAt}`}
                  className="flex items-baseline justify-between gap-3 border-t border-[var(--rule)] py-2 text-sm first:border-t-0"
                >
                  <span>
                    {formatDate(started)}
                    <span className="num text-[var(--muted)]"> {time}</span>
                  </span>
                  <span className="num text-[var(--muted)]">
                    {sitting.pages} pp · {duration}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
