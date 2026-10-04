import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDashboard,
  equivalentLine,
  isIdle,
  stitchSittings,
} from "./stats";
import type { BookRecord, PageVisit } from "./types";
import { IDLE_CAP_SECONDS } from "./types";

const TZ = "America/Los_Angeles";
const NOW = Date.parse("2026-10-04T19:00:00Z") / 1000;

function visit(
  bookId: number,
  page: number,
  iso: string,
  duration: number,
): PageVisit {
  return {
    bookId,
    page,
    startTime: Date.parse(iso) / 1000,
    duration,
  };
}

const book = (
  id: number,
  pages: number,
  title = `Book ${id}`,
): BookRecord => ({
  id,
  title,
  authors: "Author",
  pages,
  lastOpen: NOW,
});

test("idle cap treats long durations as parked", () => {
  assert.equal(isIdle(IDLE_CAP_SECONDS), false);
  assert.equal(isIdle(IDLE_CAP_SECONDS + 1), true);
});

test("current page uses the latest session, not max page", () => {
  const payload = buildDashboard(
    [
      visit(1, 10, "2026-09-20T19:00:00Z", 40),
      visit(1, 11, "2026-10-03T19:00:00Z", 50),
      visit(1, 2, "2026-10-04T19:00:01Z", 20),
    ],
    [book(1, 200)],
    TZ,
    NOW,
  );
  assert.equal(payload.books[0]?.currentPage, 2);
  assert.equal(payload.books[0]?.status, "reading");
});

test("week and month pages count unique book-page pairs", () => {
  const payload = buildDashboard(
    [
      visit(1, 10, "2026-10-01T19:00:00Z", 40),
      visit(1, 10, "2026-10-02T19:00:00Z", 40),
      visit(1, 11, "2026-10-03T19:00:00Z", 40),
      visit(1, 12, "2026-09-01T19:00:00Z", 40),
    ],
    [book(1, 200)],
    TZ,
    NOW,
  );
  assert.equal(payload.summary.pagesThisWeek, 2);
  assert.equal(payload.summary.pagesThisMonth, 2);
});

test("idle seconds are excluded from active totals and TTF pace", () => {
  const payload = buildDashboard(
    [
      visit(1, 10, "2026-10-04T18:00:00Z", 40),
      visit(1, 11, "2026-10-04T18:01:00Z", 900),
    ],
    [book(1, 12)],
    TZ,
    NOW,
  );
  const row = payload.books[0];
  assert.equal(row?.totalActiveSeconds, 40);
  assert.equal(row?.totalIdleSeconds, 900);
  assert.equal(payload.summary.totalActiveSeconds, 40);
  assert.equal(row?.ttfSeconds, 40);
});

test("sittings split on a 15 minute gap", () => {
  const sittings = stitchSittings([
    visit(1, 1, "2026-10-04T18:00:00Z", 30),
    visit(1, 2, "2026-10-04T18:01:00Z", 30),
    visit(1, 3, "2026-10-04T18:20:00Z", 30),
  ]);
  assert.equal(sittings.length, 2);
  assert.equal(sittings[1]?.pages, 2);
  assert.equal(sittings[0]?.pages, 1);
});

test("abandoned is reading only, between 5 and 90 percent, after 21 days", () => {
  const payload = buildDashboard(
    [visit(1, 40, "2026-08-01T19:00:00Z", 40)],
    [book(1, 200)],
    TZ,
    NOW,
  );
  assert.equal(payload.books[0]?.abandoned, true);
  assert.equal(payload.books[0]?.status, "reading");

  const finished = buildDashboard(
    [visit(2, 200, "2026-08-01T19:00:00Z", 40)],
    [book(2, 200)],
    TZ,
    NOW,
  );
  assert.equal(finished.books[0]?.status, "finished");
  assert.equal(finished.books[0]?.abandoned, false);
});

test("coverage uses unique pages, recency uses the latest page", () => {
  const payload = buildDashboard(
    [
      visit(1, 1, "2026-10-01T19:00:00Z", 20),
      visit(1, 1, "2026-10-02T19:00:00Z", 20),
      visit(1, 100, "2026-10-04T19:00:00Z", 20),
    ],
    [book(1, 100)],
    TZ,
    NOW,
  );
  assert.equal(payload.books[0]?.uniquePages, 2);
  assert.equal(payload.books[0]?.coveragePct, 2);
  assert.equal(payload.books[0]?.progressPct, 100);
  assert.equal(payload.books[0]?.status, "finished");
});

test("equivalents line uses active time and mentions parked idle", () => {
  const line = equivalentLine(55 * 3600 * 2.4, 1800);
  assert.match(line, /2\.4 times the Lord of the Rings trilogy/);
  assert.match(line, /30m parked/);
});
