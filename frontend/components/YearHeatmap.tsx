import { fillYear, weekStart, zonedParts } from "@/lib/stats";
import { formatDuration, shortDate } from "@/lib/format";
import type { DayCell } from "@/lib/types";

function heatLevel(seconds: number): number {
  if (seconds <= 0) {
    return 0;
  }
  if (seconds < 15 * 60) {
    return 1;
  }
  if (seconds < 45 * 60) {
    return 2;
  }
  if (seconds < 90 * 60) {
    return 3;
  }
  return 4;
}

export function YearHeatmap({ days, timeZone }: { days: DayCell[]; timeZone: string }) {
  const today = zonedParts(Date.now() / 1000, timeZone).date;
  const year = fillYear(days, today);
  const first = year[0]?.date ?? today;
  const pad = daysBetweenMonday(first);
  const cells: Array<DayCell | null> = [
    ...Array.from({ length: pad }, () => null),
    ...year,
  ];
  const weeks = Math.ceil(cells.length / 7);

  return (
    <section>
      <h2 className="mb-3 text-[13px] font-medium text-[var(--muted)]">This year</h2>
      <div className="overflow-x-auto">
        <div
          className="grid w-max gap-[3px]"
          style={{
            gridTemplateRows: "repeat(7, 11px)",
            gridAutoFlow: "column",
            gridAutoColumns: "11px",
          }}
        >
          {Array.from({ length: weeks * 7 }, (_, index) => {
            const cell = cells[index];
            if (!cell) {
              return <span key={`pad-${index}`} />;
            }
            const level = heatLevel(cell.activeSeconds);
            const title = `${shortDate(cell.date)}, ${formatDuration(cell.activeSeconds)} active`;
            return (
              <span
                key={cell.date}
                title={title}
                className="block rounded-[2px]"
                style={{ background: `var(--heat-${level})` }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function daysBetweenMonday(iso: string): number {
  const monday = weekStart(iso);
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  const start = new Date(`${monday}T00:00:00Z`);
  return Math.round((date.getTime() - start.getTime()) / 86_400_000);
}
