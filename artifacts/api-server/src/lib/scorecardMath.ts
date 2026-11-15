import { AppError } from "./permissions";

export type Direction = "at_least" | "at_most" | "range";
export function weekStart(date = new Date()) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
export function validateWeek(value: string, now = new Date()) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value || date.getUTCDay() !== 1) {
    throw new AppError(400, "Choose a valid week starting on Monday.");
  }
  if (value > weekStart(now)) throw new AppError(400, "Future weeks cannot have results yet.");
  return value;
}
export function scorecardWeeks(end: string) {
  const date = new Date(`${end}T00:00:00Z`);
  return Array.from({ length: 13 }, (_, i) => new Date(date.getTime() - (12 - i) * 7 * 86400000).toISOString().slice(0, 10));
}
export function scorecardStatus(value: number | null, direction: Direction, target: number, upper: number | null): "on_track" | "off_track" | "missing" {
  if (value === null) return "missing";
  const met = direction === "at_least" ? value >= target : direction === "at_most" ? value <= target : value >= target && upper !== null && value <= upper;
  return met ? "on_track" : "off_track";
}
