import { loadStats } from "./koreader";
import type { Payload } from "./types";

export async function getDashboard(): Promise<Payload> {
  return loadStats();
}
