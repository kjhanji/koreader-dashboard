import { Dashboard } from "@/components/Dashboard";
import { getDashboard } from "@/lib/api";
import { fixturePayload } from "@/lib/fixture";
import { emptyPayload } from "@/lib/stats";

export const dynamic = "force-dynamic";

function timeZone() {
  return process.env.TIMEZONE ?? "America/Los_Angeles";
}

export default async function Page() {
  let payload = emptyPayload("Could not reach the stats file");
  try {
    payload =
      process.env.DASHBOARD_FIXTURE === "1" ? fixturePayload() : await getDashboard();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    payload = emptyPayload(message);
  }

  return <Dashboard payload={payload} timeZone={timeZone()} />;
}
