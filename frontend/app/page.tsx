import { refreshStats } from "@/app/actions";
import { getBooks, getSummary } from "@/lib/api";
import { formatDate, formatDuration } from "@/lib/format";
import type { Book, Summary } from "@/lib/types";
import { ReadingChart } from "@/components/ReadingChart";

export const dynamic = "force-dynamic";

function emptySummary(): Summary {
  return {
    total_reading_seconds: 0,
    streak_days: 0,
    pages_this_week: 0,
    pages_this_month: 0,
    books_finished: 0,
    daily: [],
    weekly: [],
    last_synced: null,
    stale: true,
    last_error: "Could not reach the stats API",
  };
}

async function loadDashboard(): Promise<{ books: Book[]; summary: Summary }> {
  try {
    const [books, summary] = await Promise.all([getBooks(), getSummary()]);
    return { books, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { books: [], summary: { ...emptySummary(), last_error: message } };
  }
}

function BookRow({ book }: { book: Book }) {
  return (
    <li className="border-b border-[#d8d0c4] py-4 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div
            className="text-lg leading-snug"
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          >
            {book.title ?? "Untitled"}
          </div>
          <div
            className="text-sm text-[#6f675c]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {book.authors ?? "Unknown author"}
          </div>
        </div>
        <div
          className="shrink-0 text-right text-sm text-[#6f675c]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {book.status === "finished"
            ? formatDate(book.last_read)
            : `${book.current_page}/${book.pages}`}
        </div>
      </div>
      {book.status === "reading" ? (
        <div className="mt-3">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(100, book.progress_pct)}%` }}
            />
          </div>
          <div
            className="mt-1 text-xs text-[#6f675c]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {book.progress_pct.toFixed(1)}% · last read {formatDate(book.last_read)}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export default async function Page() {
  const { books, summary } = await loadDashboard();
  const reading = books
    .filter((book) => book.status === "reading")
    .sort((a, b) => (b.last_read ?? "").localeCompare(a.last_read ?? ""));
  const finished = books
    .filter((book) => book.status === "finished")
    .sort((a, b) => (b.last_read ?? "").localeCompare(a.last_read ?? ""));

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p
            className="text-sm tracking-wide text-[#6f675c] uppercase"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            KOReader
          </p>
          <h1
            className="text-4xl"
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          >
            Reading
          </h1>
        </div>
        <form action={refreshStats}>
          <button
            type="submit"
            className="rounded-full border border-[#d8d0c4] bg-[#fbf7f0] px-4 py-2 text-sm text-[#2b241c]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Refresh
          </button>
        </form>
      </header>

      {summary.stale || summary.last_error ? (
        <div
          className="mb-6 rounded-xl border border-[#e3c8b8] bg-[#f8efe9] px-4 py-3 text-sm text-[#8a4b2f]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {summary.stale
            ? "Showing last known stats. The latest file from Koofr could not be loaded."
            : null}
          {summary.last_error ? (
            <div className="mt-1 text-[#6f675c]">{summary.last_error}</div>
          ) : null}
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Streak" value={`${summary.streak_days}d`} />
        <Stat label="This week" value={`${summary.pages_this_week} pp`} />
        <Stat label="This month" value={`${summary.pages_this_month} pp`} />
        <Stat label="Finished" value={String(summary.books_finished)} />
      </section>

      <p
        className="mb-8 text-sm text-[#6f675c]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {formatDuration(summary.total_reading_seconds)} total
        {summary.last_synced ? ` · synced ${formatDate(summary.last_synced)}` : ""}
      </p>

      <div className="mb-8">
        <ReadingChart daily={summary.daily} weekly={summary.weekly} />
      </div>

      <section className="mb-10">
        <h2
          className="mb-2 text-xl"
          style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
        >
          Currently reading
        </h2>
        {reading.length === 0 ? (
          <Empty text="Nothing in progress." />
        ) : (
          <ul>{reading.map((book) => <BookRow key={book.id} book={book} />)}</ul>
        )}
      </section>

      <section>
        <h2
          className="mb-2 text-xl"
          style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
        >
          Finished
        </h2>
        {finished.length === 0 ? (
          <Empty text="No finished books yet." />
        ) : (
          <ul>{finished.map((book) => <BookRow key={book.id} book={book} />)}</ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#d8d0c4] bg-[#fbf7f0] px-4 py-3">
      <div
        className="text-xs tracking-wide text-[#6f675c] uppercase"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-2xl"
        style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
      >
        {value}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-sm text-[#6f675c]" style={{ fontFamily: "var(--font-sans)" }}>
      {text}
    </p>
  );
}
