import { loadStats } from "./koreader";
import type { Book, Summary } from "./types";

export async function getBooks(): Promise<Book[]> {
  const payload = await loadStats();
  return payload.books;
}

export async function getSummary(): Promise<Summary> {
  const payload = await loadStats();
  return payload.summary;
}
