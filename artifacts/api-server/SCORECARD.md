# Scorecard tracker

The Scorecard uses timestamped measurement history, not editable weekly cells.

## Behavior

- Owners and admins append numeric values; every save creates a separate record, including repeated values and zero.
- Identity, unit and timestamps are server-derived. Staff may remove their own entries, including after ownership changes; admins may remove any. Removal is soft and audited.
- The current value is the latest undeleted entry. Removing it exposes the preceding value. Historical clearings remain null, not zero.
- Admins configure metrics, optional Master Calendar event links, optional contextual QBO key-result links, and up to 100 uniquely dated milestones.
- The latest target due in Sacramento time determines status. Before the first milestone, no target is due yet. Without dated milestones, the standing goal applies.
- Targets may use at-least, at-most, or range comparisons. Units cannot change once history exists; incompatible legacy units remain visible in history but are explicitly excluded from the chart.
- Measurement updates do not change an event or the official QBO key-result value.

## Legacy preservation

Apply the generated schema changes before starting the new API version. Startup idempotently copies all weekly revisions, including corrections and clearings, with their original authors, timestamps, units, notes and week references. Older entries without revisions are preserved as well. Original weekly tables are retained.

Backfill never recreates removed measurements. The old weekly PUT returns 410 with a refresh instruction so an older tab cannot overwrite the new append-only history.

## API and Claude

- `GET /api/svp/scorecard/tracker`: metric definitions, dated milestones and latest undeleted measurements.
- `GET /api/svp/scorecard/trend?metricId=…&after=…&limit=…`: chronological, stable-cursor history, at most 250 entries per response.
- `POST /api/svp/scorecard/metrics/:id/measurements`: append `{value, note}`.
- `DELETE /api/svp/scorecard/measurements/:id`: author/admin removal.
- Existing metric create/update routes accept event links and milestones atomically. Edits with dated targets require the metric's `updatedAt` as `expectedUpdatedAt`.
- Read-only MCP domains `scorecard_metrics`, `scorecard_measurements` and `scorecard_milestones` provide current operating data. `scorecard_entries` and `scorecard_history` retain legacy weekly context.

The UI loads all trend pages and reports partial-loading errors rather than silently presenting an incomplete history. CSV export also fetches complete history.

## Verification

```sh
pnpm --filter @workspace/scripts exec tsx --test ../artifacts/api-server/tests/scorecard.test.ts
bash scripts/test-okr-ui.sh
pnpm --filter @workspace/scripts exec tsx verify-scorecard-browser.ts --chromium=/path/to/chromium
```

The browser exercise uses legitimate development quick-login sessions, creates a uniquely marked temporary metric, tests event configuration, real edits, values, chart, role permissions and mobile, then removes only its exact fixtures in `finally`. It never changes the referenced calendar event or real planning records.
