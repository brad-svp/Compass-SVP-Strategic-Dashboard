---
name: Safe OKR testing
description: Keep test fixtures outside real planning cycles and use app-equivalent frontend transforms.
---

Never verify OKR creation by adding sample objectives to a real business cycle. Use disposable database schemas for service tests and fixture-only component rendering.

**Why:** The user’s brief requires the real 2027 cycle to stay empty until staff enter actual objectives. PostgreSQL `search_path` alone does not isolate foreign keys that generated SQL explicitly qualifies with `public`.

**How to apply:** Review fully qualified references whenever reusing generated schema SQL for isolated tests. Frontend render tests also need the app’s Vite-style environment substitutions, automatic JSX, and one consistent React instance; plain Node/TypeScript execution does not supply those semantics. Never add a running-app authentication bypass merely to verify protected pages. This does not prohibit testing an explicitly user-requested development login feature; see the current product rules in `replit.md`.
