export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.max(0, Math.round(seconds))}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours <= 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

export function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 0.1) {
    return `${Math.round(seconds / 60)}m`;
  }
  return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
}

export function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function shortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function localISODate(day: Date): string {
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

export function fillDaily(points: { date: string; seconds: number }[], days = 28) {
  const byDate = new Map(points.map((point) => [point.date, point.seconds]));
  const result: { date: string; seconds: number; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const key = localISODate(day);
    result.push({
      date: key,
      seconds: byDate.get(key) ?? 0,
      label: shortDate(key),
    });
  }
  return result;
}

export function fillWeekly(
  points: { week_start: string; seconds: number }[],
  weeks = 12,
) {
  const byWeek = new Map(points.map((point) => [point.week_start, point.seconds]));
  const result: { date: string; seconds: number; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  const weekday = (today.getDay() + 6) % 7;
  monday.setDate(today.getDate() - weekday);
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);
    const key = localISODate(start);
    result.push({
      date: key,
      seconds: byWeek.get(key) ?? 0,
      label: shortDate(key),
    });
  }
  return result;
}
