# SVP Compass Organizational Brain

## Access and trust

- `/brain` is staff-only. Entries are searchable immediately as **Unreviewed**.
- Staff can amend their own unreviewed contributions. Admins manage canonical content, approval, conflicts, retirement, duplicate consolidation and version restoration.
- An edit or attachment change creates an immutable version and resets review. Admins set review intervals and inspect overdue content/indexing failures.
- Admin-only entry visibility applies before returning entries, chunks, files or version history.
- Entries can reference live programs, areas, systems, purpose and other records rather than copying volatile facts.
- Duplicate consolidation retires the duplicate and records its canonical destination; administrators first amend the destination with any material they want retained. Source history remains intact.

## Search and processing

- PostgreSQL full-text retrieval and real local 384-dimensional embeddings are combined; reviewed, nonconflicted evidence receives a ranking preference.
- Model: `Xenova/all-MiniLM-L6-v2`, Apache-2.0, revision `751bff37182d3f1213fa05d7196b954e230abad9`, quantized CPU ONNX.
- Model source/license: https://huggingface.co/Xenova/all-MiniLM-L6-v2
- Model files download on first semantic query or index job and are cached beneath ignored `generated-artifacts/models`. They are not checked into Git or packaged as documents. An autoscaled cold instance may download again. Allow network access and enough memory for the model/runtime; monitor cold-start resource use before increasing document volume.
- A failed semantic load is shown explicitly. Keyword search over written entries is immediately available; semantic/file chunk readiness is never silently claimed.
- Persistent jobs claim one entry at a time with `SKIP LOCKED`, retry up to three times, recover abandoned locks after ten minutes and atomically replace chunks only if the source version is still current.
- Only current-version chunks are returned. Visibility/retirement are checked live, including during pending or failed indexing.
- Search combines independently bounded entry-text, attachment-keyword and semantic candidate pools (100 each), then ranks/deduplicates and returns 50 per page; browse has full count/pagination. Exact attachment keywords remain eligible even when their embeddings have low similarity. Refine large searches by topic/program/area/status.
- Search excerpts are reference data, not trusted instructions. No document instructions are executed.

## Files

- Originals use private App Storage; signed PUT goes directly from browser to storage. Completion copies a generation-pinned source to a new server-only key.
- Downloads require a current staff session and entry visibility. MIME is forced to attachment/octet-stream and `nosniff`.
- Up to 20 MB per file. TXT/Markdown/CSV extract up to 500,000 characters. DOCX expands at most 20 MB and extracts up to 500,000 characters. PDF extracts the first 100 pages, up to 50,000 characters each. Split larger references to retain full coverage.
- Up to 600 chunks per entry; larger entries fail explicitly and can be split/retried. Other formats remain downloadable unsupported attachments. Scanned/image-only PDFs are `text_empty`; OCR is not included.
- Admins can retry failed jobs or reindex all entries. File removal/replacement is versioned; old files are retained privately for administrator restoration, not searchable/current downloads.

## Claude MCP / OAuth

- Remote endpoint: `/api/mcp`, stateless Streamable HTTP with JSON responses.
- Discovery: `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server`.
- Maintained MCP SDK provides protocol, authorization handlers, client authentication, PKCE validation and rate limiting.
- Each user signs in with their real, active, invited SVP Google/Clerk identity and explicitly grants scopes. Development quick-login identities cannot authorize MCP.
- Scopes: `brain:read`, `operations:read`, `brain:write`.
- High-entropy opaque tokens are stored hashed, bound to a client/resource/active staff grant, with one-hour access tokens and rotated 30-day refresh tokens. Refresh replay revokes the connection. Codes are single-use and expire two minutes after approval. Consent requests expire in ten minutes.
- Exact registered HTTPS redirect URIs (or native loopback HTTP) only. Public PKCE clients register with token endpoint authentication `none`. The exact resource URL is required in authorization/token/refresh requests.
- Every MCP request AND tool call rechecks the token/grant and active staff membership. Users can revoke connections immediately from `/brain/connections`.
- Read tools: `search`, `fetch`, `data_catalog`, `read_operations`, `operating_brief`. Operational reads are allowlisted and bounded; no SQL interpreter, credentials, auth/session tables, subscription keys or upload-signing URLs are exposed. Audit is admin-only.
- Calendar, QBOs, quarterly narratives, scorecards and personal 6x6 data are **read-only**. Only `contribute_knowledge` and `propose_amendment` write, always to Unreviewed knowledge.
- `/brain/connections` provides the actual current endpoint, setup steps, scope/revocation controls and downloadable Claude skill.
- Browser writes retain existing same-origin session protections. OAuth/MCP has its own bearer transport; it does not bypass browser authentication.

## Publishing and first real connection

1. Publishing must be done explicitly by the user. The new version is not automatically published.
2. Production origin is configured in `SVP_PUBLIC_ORIGIN` using the actual URL returned by deployment metadata. Update it deliberately for a new canonical domain.
3. Development includes the `vector` extension and generated incremental migrations. Production was checked read-only: `vector` is **available but not installed**. Before publishing this schema, a database administrator must use Replit's **production SQL console** to run `CREATE EXTENSION IF NOT EXISTS vector;`. This adds vector support; it does not delete or change business rows. Replit Publish applies the managed schema diff but does not copy this extension automatically. Do not put extension creation in the deployment build command or app entrypoint. No startup or custom production migration runner is installed.
4. Do not copy development OAuth grants/quick-login identities into a claimed production verification. Each real staff member authorizes their own Claude connector.
5. In Claude Settings → Connectors, add the MCP URL shown by the **published** app's connection screen, sign into SVP Google and grant the requested scopes.
6. Ask Claude to read the calendar/QBOs/6x6, fetch cited knowledge, then—after showing and approving the exact content—save a lesson. Confirm its Unreviewed entry in Compass.
7. Until those user-controlled steps occur, only local HTTP OAuth/MCP protocol verification is reported, not a live Claude round-trip.

## Verification

- `pnpm --filter @workspace/scripts exec tsx --test ../artifacts/api-server/tests/brain-and-direction.test.ts`
  creates a disposable schema, tests trust/permissions/versions, real PDF/DOCX extraction, semantic indexing, all operating domains, OAuth replay/resource/scope behavior, HTTP discovery/token/initialization/tools and warm retrieval over 10,000 synthetic chunks.
- `artifacts/svp-os/tests/narrative-plan-brain-ui.test.tsx` uses fixture-only SSR with the same esbuild pattern as `scripts/test-okr-ui.sh`.
- `pnpm --filter @workspace/scripts exec tsx ../artifacts/api-server/tests/verify-brain-upload.ts`
  is an explicit development-only App Storage integration check. It creates a UUID-labeled private fixture and removes only its own records/objects.
- Observed development results: 14 backend tests passed, including attachment-only keywords with an intentionally opposite embedding; warm retrieval p95 over 10,000 chunks was 301 ms. A separate fresh process loaded the real model and embedded its first query in 2,804 ms with model files already cached on disk. An empty-cache network download was not included in that number.
- `pnpm --filter @workspace/scripts exec tsx verify-svp-browser.ts`
  uses the explicitly requested development quick-login feature—not a test auth bypass—to check staff/admin editing boundaries, account-backed teammate views across fresh browser sessions, dashboard layout, timeline anchoring/navigation and visible/selectable program/status options in a reduced-height viewport. It restores the development accounts' original viewing preferences and does not create planning content. Chromium verification is not a claim of iPad Safari or real Google/Claude OAuth verification.
