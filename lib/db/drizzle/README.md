# Development schema history

`0000_phase2_okrs.sql` is the initial full-schema baseline, including the foundation
tables that already existed before migration snapshots were introduced. Do not
execute the baseline against an existing foundation database.

For subsequent development changes:

1. Change the Drizzle schema.
2. Run `pnpm --filter @workspace/db exec drizzle-kit generate --name <change>`.
3. Review and retain the generated SQL and snapshots.
4. Apply the reviewed change to development with `pnpm --filter @workspace/db run push`.
5. When changing an existing check constraint, verify its live definition with
   `pg_get_constraintdef`; a successful push may leave the prior check unchanged.
   If needed, apply just the reviewed constraint replacement transactionally,
   not the full migration over tables already created by push.

The snapshot is the comparison point for future incremental SQL generation.
There is intentionally no app-startup migration runner or deployment migration
hook. Managed production schema changes are applied through Replit Publish.
