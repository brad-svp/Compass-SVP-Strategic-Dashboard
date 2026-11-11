export const clamp = (value: number) => Math.max(0, Math.min(100, value));
export function metricProgress(start: number, target: number, current: number | null) {
  return current === null || target === start ? 0 : clamp((current - start) / (target - start) * 100);
}
export function expectedProgress(startDate: string, endDate: string, scope: string, now = new Date()) {
  let start = new Date(`${startDate}T00:00:00Z`).getTime();
  let end = new Date(`${endDate}T00:00:00Z`).getTime() + 86400000;
  if (scope !== "annual") {
    const quarter = Number(scope.slice(1));
    const year = Number(startDate.slice(0, 4));
    start = Math.max(start, Date.UTC(year, (quarter - 1) * 3, 1));
    end = Math.min(end, Date.UTC(year, quarter * 3, 1));
  }
  return end <= start ? 100 : clamp((now.getTime() - start) / (end - start) * 100);
}
export function progressHealth(type: string, progress: number, expected: number, hasValue: boolean): "green" | "yellow" | "red" | "none" {
  if (!hasValue) return "none";
  if (type === "confidence") return progress >= 70 ? "green" : progress >= 40 ? "yellow" : "red";
  const behind = expected - progress;
  return behind <= 10 ? "green" : behind <= 25 ? "yellow" : "red";
}
