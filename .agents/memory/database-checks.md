---
name: Database check constraint verification
description: Prevent drift between generated migrations, isolated tests and the development database's actual constraints.
---

After changing an existing PostgreSQL check constraint, verify its actual definition in the target development database before declaring the change applied.

**Why:** The schema tool reported success while leaving an old annual-only objective check unchanged. Isolated tests using the reviewed incremental SQL passed, but quarterly objective saves in the application still failed.

**How to apply:** Compare the live definition with the reviewed migration. Apply only the necessary reviewed constraint replacement transactionally when the development schema tool misses it. Never replay a full incremental migration over tables it already created, and never treat disposable-schema test success as proof of live-schema parity. Production schema work still follows the publishing workflow.
