---
name: Scorecard update policy
description: User-requested change from weekly cells to timestamped metric values and dated milestone goals
---

The user requested a single latest-value input per metric instead of weekly recording cells. Every save should append a timestamped history entry, attributed with the updater's initials, and clicking the metric should open its full trend chart. Entry authors can delete their own entries; admins can delete any.

Metrics support multiple goal amounts with individual target dates, all shown in the detail chart. The user selected **latest due target** for current status: use the most recent milestone due on or before today in Sacramento time. Future milestones remain visible but are not failures. Before the first milestone, no target is due. If there are no dated milestones, retain the standing goal.

The user expects metrics to commonly link to events, such as registration counts. Keep event links optional so non-event operating metrics remain possible.

**Why:** The user wants a simpler ongoing update process and intermediate targets that make progress visible over time.

**How to apply:** Preserve existing values/history; do not overwrite measurements or invent timestamps. Removing a chart entry retains its audit record and must not resurrect it during legacy backfill. Keep the Brain's operational scorecard reads aligned and read-only through MCP.

Do not silently convert or plot incompatible historical units together. A different unit after recording values requires a new metric.

**Why:** A numeric trend is misleading if people, dollars or percentages are silently treated as the same measure.
