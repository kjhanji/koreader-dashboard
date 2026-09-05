"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fillDaily, fillWeekly, formatDuration } from "@/lib/format";
import type { DailyPoint, WeeklyPoint } from "@/lib/types";

type Props = {
  daily: DailyPoint[];
  weekly: WeeklyPoint[];
};

export function ReadingChart({ daily, weekly }: Props) {
  const [range, setRange] = useState<"daily" | "weekly">("daily");
  const data = useMemo(
    () => (range === "daily" ? fillDaily(daily) : fillWeekly(weekly)),
    [daily, weekly, range],
  );

  return (
    <section className="rounded-2xl border border-[#d8d0c4] bg-[#fbf7f0] p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2
          className="text-xl"
          style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
        >
          Reading time
        </h2>
        <div className="flex gap-1 text-sm" style={{ fontFamily: "var(--font-sans)" }}>
          <button
            type="button"
            onClick={() => setRange("daily")}
            className={`rounded-full px-3 py-1 ${
              range === "daily" ? "bg-[#3f5d4a] text-[#fbf7f0]" : "text-[#6f675c]"
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setRange("weekly")}
            className={`rounded-full px-3 py-1 ${
              range === "weekly" ? "bg-[#3f5d4a] text-[#fbf7f0]" : "text-[#6f675c]"
            }`}
          >
            Weekly
          </button>
        </div>
      </div>
      <div className="h-56" style={{ fontFamily: "var(--font-sans)" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: "#6f675c", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={range === "daily" ? 6 : 0}
            />
            <YAxis
              tickFormatter={(value: number) => formatDuration(value)}
              tick={{ fill: "#6f675c", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ fill: "rgba(63, 93, 74, 0.08)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) {
                  return null;
                }
                const point = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-lg border border-[#d8d0c4] bg-[#fbf7f0] px-3 py-2 text-sm shadow-sm">
                    <div className="text-[#6f675c]">{point.label}</div>
                    <div>{formatDuration(point.seconds)}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="seconds" fill="#3f5d4a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
