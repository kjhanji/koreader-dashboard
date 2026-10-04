import type { FingerprintTick } from "@/lib/types";

export function Fingerprint({
  pages,
  ticks,
}: {
  pages: number;
  ticks: FingerprintTick[];
}) {
  if (pages <= 0) {
    return <p className="text-sm text-[var(--muted)]">No page count for this book.</p>;
  }

  const byPage = new Map(ticks.map((tick) => [tick.page, tick]));
  const peak = Math.max(1, ...ticks.map((tick) => tick.activeSeconds));

  return (
    <div
      className="flex h-10 w-full overflow-hidden rounded-[var(--radius-sm)] bg-[var(--heat-0)]"
      title="Time on each page. Brighter is slower. A top mark means a reread."
    >
      {Array.from({ length: pages }, (_, index) => {
        const page = index + 1;
        const tick = byPage.get(page);
        const active = tick?.activeSeconds ?? 0;
        const visits = tick?.visits ?? 0;
        const t = active / peak;
        const background =
          active <= 0
            ? "transparent"
            : `color-mix(in srgb, var(--accent) ${Math.round(18 + t * 82)}%, var(--heat-0))`;
        return (
          <span
            key={page}
            className="relative min-w-0 flex-1"
            style={{ background }}
            title={`Page ${page}${visits ? `, ${visits} visit${visits === 1 ? "" : "s"}` : ""}`}
          >
            {visits > 1 ? (
              <span className="absolute inset-x-0 top-0 h-px bg-[var(--ink)]" />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
