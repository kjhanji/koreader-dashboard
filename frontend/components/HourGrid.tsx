import type { HourCell } from "@/lib/types";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

function heatLevel(seconds: number): number {
  if (seconds <= 0) {
    return 0;
  }
  if (seconds < 30 * 60) {
    return 1;
  }
  if (seconds < 2 * 3600) {
    return 2;
  }
  if (seconds < 6 * 3600) {
    return 3;
  }
  return 4;
}

export function HourGrid({ hours }: { hours: HourCell[] }) {
  const lookup = new Map(
    hours.map((cell) => [`${cell.weekday}-${cell.hour}`, cell.activeSeconds]),
  );

  return (
    <section>
      <h2 className="mb-3 text-[13px] font-medium text-[var(--muted)]">Hours</h2>
      <div className="overflow-x-auto">
        <div
          className="grid w-max gap-[3px]"
          style={{ gridTemplateColumns: "16px repeat(24, 12px)" }}
        >
          <span />
          {Array.from({ length: 24 }, (_, hour) => (
            <span
              key={`h-${hour}`}
              className="num text-center text-[10px] text-[var(--muted)]"
            >
              {hour === 0 || hour === 6 || hour === 12 || hour === 18 ? hour : ""}
            </span>
          ))}
          {DAYS.map((label, weekday) => (
            <HourRow
              key={`d-${weekday}`}
              label={label}
              weekday={weekday}
              lookup={lookup}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function HourRow({
  label,
  weekday,
  lookup,
}: {
  label: string;
  weekday: number;
  lookup: Map<string, number>;
}) {
  return (
    <>
      <span className="self-center text-[10px] text-[var(--muted)]">{label}</span>
      {Array.from({ length: 24 }, (_, hour) => {
        const seconds = lookup.get(`${weekday}-${hour}`) ?? 0;
        const level = heatLevel(seconds);
        return (
          <span
            key={`${weekday}-${hour}`}
            title={`${label} ${String(hour).padStart(2, "0")}:00`}
            className="h-[12px] w-[12px] rounded-[2px]"
            style={{ background: `var(--heat-${level})` }}
          />
        );
      })}
    </>
  );
}
