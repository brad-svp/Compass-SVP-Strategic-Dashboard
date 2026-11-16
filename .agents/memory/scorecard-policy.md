---
name: Scorecard update policy
description: User-requested change from weekly cells to timestamped metric values and dated milestone goals
---

The user requested a single latest-value input per metric instead of weekly recording cells. Every save should append a timestamped history entry, attributed with the updater's initials, and clicking the metric should open its full trend chart. Entry authors can delete their own entries; admins can delete any.

Metrics should support multiple goal amounts with individual target dates, all shown in the detail chart.

**Why:** The user wants a simpler ongoing update process and intermediate targets that make progress visible over time.

**How to apply:** Preserve existing values/history during the redesign; do not overwrite prior measurements or invent timestamps. Keep the Brain's operational scorecard reads aligned with any replacement data model and read-only through MCP. Current-status judgment against dated targets needs an explicit product choice rather than assuming future targets have already been missed.
