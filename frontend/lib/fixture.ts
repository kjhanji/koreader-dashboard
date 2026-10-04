import { buildDashboard, isoInZone } from "./stats";
import type { BookRecord, PageVisit, Payload } from "./types";

const TZ = "America/Los_Angeles";
const NOW = Date.parse("2026-10-04T19:00:00Z") / 1000;

function visit(bookId: number, page: number, iso: string, duration: number): PageVisit {
  return { bookId, page, startTime: Date.parse(iso) / 1000, duration };
}

function book(id: number, title: string, authors: string, pages: number): BookRecord {
  return { id, title, authors, pages, lastOpen: NOW };
}

export function fixturePayload(): Payload {
  const visits: PageVisit[] = [];
  for (let day = 0; day < 190; day += 1) {
    if (day % 4 === 0) {
      continue;
    }
    const date = new Date(Date.parse("2026-03-20T03:00:00Z") + day * 86_400_000);
    const iso = date.toISOString();
    visits.push(visit(1, 20 + (day % 80), iso, 35 + (day % 12) * 8));
    if (day % 6 === 0) {
      visits.push(visit(1, 20 + (day % 80), new Date(date.getTime() + 3600_000).toISOString(), 800));
    }
    if (day % 3 === 0) {
      visits.push(visit(2, 5 + (day % 40), iso, 50));
    }
  }
  visits.push(visit(1, 384, "2026-10-04T06:10:00Z", 42));
  visits.push(visit(1, 385, "2026-10-04T06:12:00Z", 38));
  visits.push(visit(3, 245, "2026-08-01T04:00:00Z", 40));
  visits.push(visit(4, 245, "2026-08-12T02:00:00Z", 55));
  visits.push(visit(5, 10, "2026-07-29T18:00:00Z", 30));

  const built = buildDashboard(
    visits,
    [
      book(1, "The Overstory", "Richard Powers", 502),
      book(2, "A Distant Mirror", "Barbara Tuchman", 677),
      book(3, "The Goldfinch", "Donna Tartt", 771),
      book(4, "Piranesi", "Susanna Clarke", 245),
      book(5, "Project Hail Mary", "Andy Weir", 10),
    ],
    TZ,
    NOW,
  );
  return {
    books: built.books,
    days: built.days,
    hours: built.hours,
    summary: {
      ...built.summary,
      lastSynced: isoInZone(NOW, TZ),
      stale: false,
      lastError: null,
    },
  };
}
