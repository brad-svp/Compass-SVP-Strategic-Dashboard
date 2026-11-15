# SVP OS

Internal strategic operating system for SVP Sacramento: annual alignment, six-week planning, team ownership, and a directory of shared systems.

## Delivery scope

The user supplied a six-phase build brief in `attached_assets/SVP_OS_—_Replit_Build_Prompt_1794430137287.pdf`. **Foundation and Phase 2 OKRs** are implemented: branded welcome, Google sign-in, staff access checks, staff/areas/cycles administration, audit logging, company/individual OKRs, metric/confidence KRs, append-only check-ins, comments, and a live strategic dashboard. Team & Ownership also includes the user's editable 2027 accountability chart. Editable 6x6, RACI, Systems, Learn, AI, CRM, and MCP remain subsequent phases. The seeded 6x6 remains a read-only preview.

## Product rules

- This is a system of alignment, not a second CRM. Future CRM integration must be read-only and must not update official KR values without an owner's check-in.
- Never seed sample OKRs in the real 2027 cycle. Show “Start by adding your company objectives.”
- Published sign-in requires a verified `svpsacramento.org` Google identity matching an active admin-managed staff record.
- The user explicitly requested development quick-login options for both staff and admin. These use separate labeled test identities, never real staff impersonation. Anyone with the development link can use them and change development data. Never enable this shortcut on a published app.
- People are the primary unit; areas remain separate records supporting multiple people.
- All writes use shared server service/permission functions and transactional audit records, including future MCP writes.
- The source brief defines the build order: Foundation; OKRs; 6x6; Team/Systems/Learn; AI; CRM/MCP.
- Team & Ownership uses the supplied 2027 accountability chart (`attached_assets/image_1794780435602.png`): Board, Visionary, Integrator, and six functional seats. Drew holds the Integrator, Programs, and Operations & Finance seats. Admins edit the chart; all staff can read it. Accountability seats are separate from login permissions and department assignments, and importing the chart must not silently rename existing staff accounts.

## Branding

Match the supplied SVP brief: navy `#0A2540`, blue `#1D8BC4`, accents green `#49B949`, orange `#ECA519`, magenta `#B03E71`. Fraunces titles, Inter body. Desktop first; dashboard, check-ins, and 6x6 must work on phones. The CRM application's actual visual reference was not provided; these are the specified brand values.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/svp-os run dev` — frontend (use its managed workflow, which supplies PORT and BASE_PATH)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts exec tsx --test ../artifacts/api-server/tests/okrs.test.ts` — OKR service and progress tests in an isolated disposable schema (never writes sample OKRs in real cycles).
- `pnpm run test:okrs` — backend tests plus frontend render checks using the app's JSX and React configuration.
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/svp-os` — React frontend, Clerk routes, public welcome, staff workspace and admin forms.
- `artifacts/api-server/src/lib/foundationService.ts` — shared admin write/permission/audit service.
- `artifacts/api-server/src/middlewares/staffAuth.ts` — verified Google identity, domain, active staff allowlist.
- `lib/db/src/schema/foundation.ts` — foundation Drizzle tables.
- `lib/db/src/schema/okrs.ts` — objectives, key results, immutable check-in records, and comments.
- `artifacts/api-server/src/lib/okrService.ts` — shared OKR write, authorization, and transactional audit service.
- `lib/api-spec/openapi.yaml` — API contract; regenerate after edits.

## Architecture decisions

- Use Replit-managed Clerk's Google OAuth for normal sign-in. All authorization remains server-side. The explicitly requested development shortcut is separately gated by development runtime, no deployment marker, and the exact Replit development hostname; signed HttpOnly cookies expire after eight hours and on server restart.
- Initial development schema was applied using Drizzle push. Future changes should retain migration history for development; managed production schema changes go through Publish, never startup DDL.
- Seed initialization runs once per database, uses stable IDs, never overwrites admin edits, and audits seed writes.
- An admin cannot deactivate, demote, or alter their own sign-in email; another admin must make those changes to prevent accidental lockout.
- Removing an objective or key result hides it from the workspace but retains its history. Company objectives with supporting individual objectives cannot be removed until those are moved or removed. Comment deletion is author-only, even for administrators.
- Official metric/confidence values are nullable until the first check-in of that type. Switching measurement type preserves both last values and all historical check-ins; historical progress is a snapshot, not recalculated against later targets.

## Product

Six-person nonprofit staff workspace. Foundation and OKRs are live; the remaining strategic modules are phased additions.

## User preferences

Build a separate strategic dashboard that aligns with the SVP CRM branding.

## Gotchas

- Do not add authentication bypasses merely for screenshots or tests. The user-requested development quick-login feature may be tested, but must never weaken production Google authentication.
- Browser auth uses Clerk cookies, not manually attached bearer tokens.
- Frontend and API run via their existing artifact-managed workflows.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
