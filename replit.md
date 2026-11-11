# SVP OS

Internal strategic operating system for SVP Sacramento: annual alignment, six-week planning, team ownership, and a directory of shared systems.

## Delivery scope

The user supplied a six-phase build brief in `attached_assets/SVP_OS_—_Replit_Build_Prompt_1794430137287.pdf`. The first delivery implements **Foundation**, not the whole brief. It includes a branded public front door, Google sign-in, server-side staff access checks, administration of staff/areas/cycles, audit logging, and read-only previews of seeded planning periods. OKR editing/check-ins, editable 6x6, RACI, Systems, Learn, AI, CRM, and MCP remain subsequent phases. The UI labels these honestly.

## Product rules

- This is a system of alignment, not a second CRM. Future CRM integration must be read-only and must not update official KR values without an owner's check-in.
- Never seed sample OKRs in the real 2027 cycle. Show “Start by adding your company objectives.”
- Google identity must have a verified `svpsacramento.org` email and match an active admin-managed staff record. No demo bypass.
- People are the primary unit; areas remain separate records supporting multiple people.
- All writes use shared server service/permission functions and transactional audit records, including future MCP writes.
- The source brief defines the build order: Foundation; OKRs; 6x6; Team/Systems/Learn; AI; CRM/MCP.

## Branding

Match the supplied SVP brief: navy `#0A2540`, blue `#1D8BC4`, accents green `#49B949`, orange `#ECA519`, magenta `#B03E71`. Fraunces titles, Inter body. Desktop first; dashboard, check-ins, and 6x6 must work on phones. The CRM application's actual visual reference was not provided; these are the specified brand values.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/svp-os run dev` — frontend (use its managed workflow, which supplies PORT and BASE_PATH)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
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
- `lib/api-spec/openapi.yaml` — API contract; regenerate after edits.

## Architecture decisions

- Use Replit-managed Clerk's Google OAuth instead of handling Google client secrets or inventing local authentication. All application authorization is server-side.
- Initial development schema was applied using Drizzle push. Future changes should retain migration history for development; managed production schema changes go through Publish, never startup DDL.
- Seed initialization runs once per database, uses stable IDs, never overwrites admin edits, and audits seed writes.
- An admin cannot deactivate, demote, or alter their own sign-in email; another admin must make those changes to prevent accidental lockout.

## Product

Six-person nonprofit staff workspace. Foundation is live; strategic modules are phased additions.

## User preferences

Build a separate strategic dashboard that aligns with the SVP CRM branding.

## Gotchas

- No authenticated UI bypass is allowed for screenshots. The preview capture is signed out; verify protected routes separately.
- Browser auth uses Clerk cookies, not manually attached bearer tokens.
- Frontend and API run via their existing artifact-managed workflows.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
