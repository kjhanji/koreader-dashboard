import type { Book, Summary } from "./types";

const backend = process.env.BACKEND_URL ?? "http://localhost:8000";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${backend}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function getBooks(): Promise<Book[]> {
  return getJson<Book[]>("/books");
}

export async function getSummary(): Promise<Summary> {
  return getJson<Summary>("/stats/summary");
}

export function backendUrl(): string {
  return backend;
}
