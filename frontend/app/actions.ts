"use server";

import { revalidatePath } from "next/cache";
import { backendUrl } from "@/lib/api";

export async function refreshStats() {
  await fetch(`${backendUrl()}/refresh`, { method: "POST", cache: "no-store" });
  revalidatePath("/");
}
