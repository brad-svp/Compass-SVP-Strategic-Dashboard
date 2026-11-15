import source from "../data/notion-calendar-2026-2027.json";
export const calendarImportInfo = {
  sourceUrl: source.source, complete: false, recordCount: source.records.length,
  year2026: source.countsByYear["2026"], year2027: source.countsByYear["2027"],
  note: "Partial public Notion import: some source views are date-filtered, so the 2026 archive may be incomplete. Audience and Wix fields were not reliably visible and remain unset. Times reproduce the Pacific viewer display; the original stored timezone was not exposed. This is a one-time import, not a live sync.",
};
