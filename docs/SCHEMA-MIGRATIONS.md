# Schema migrations

Status: **built on 2026-10-13** (`src-tauri/src/commands/migrations.rs`), as
the first step of separate conversations (`docs/CONVERSATIONS-AND-MEMORY.md`).
Recorded on 2026-10-12, when Kevin deferred it until it could be done properly.
The rules in force are in `ARCHITECTURE.md`, "Schema evolution". This document
keeps the reasoning; where the build differs from the plan, the build notes say
so.

## Build notes

- Migration 2 (`migrations/0002_conversations.sql` plus
  `conversations::backfill`) is the first real migration, not the table drops
  queued below.
- Backups are named `olympus.sqlite.pre-v{target}-from-v{current}.bak`.
- Plain test fixtures use `migrations::TEST_SCHEMA` (the baseline, every later
  migration's SQL and the version); tests about migrating call
  `migrations::apply`. A Rust test pins the baseline's fingerprint, so editing
  `schema.sql` fails it.

## The problem

`open_database` (`src-tauri/src/lib.rs`) runs all of `src-tauri/schema.sql` on
every start, and every statement is `CREATE … IF NOT EXISTS`. That handles
exactly one kind of change: a brand-new table. Any other change silently never
reaches an existing database:

- a column added to an existing table;
- a changed constraint, default, foreign key or index definition;
- a renamed or dropped table or column;
- a data transformation.

A fresh database gets the change; Kevin's installed database does not. The app
then fails on his PC with "no such column", or behaves differently there, while
every test passes, because 38 test sites build a fresh database from
`schema.sql`. Each change since the 2026-09-07 history restart has added whole
tables, so nothing is broken today. The one exception, `delegation_runs.process_id`,
is handled by a hand-written `PRAGMA table_info` check in `open_database`.

## Design

**One path for every database.** A fresh database and Kevin's are built by the
same ordered steps, so they cannot diverge.

1. **Version.** SQLite's `PRAGMA user_version` holds the schema version. Today
   every database reads `0`.
2. **Baseline.** `schema.sql` as it stands when this lands becomes migration 1,
   frozen. The `process_id` check becomes part of migration 1, so a version-0
   database from any earlier release reaches the same baseline.
3. **Migrations.** An ordered list in Rust, `MIGRATIONS: &[Migration]`, each
   with a version number, a name and either SQL or a Rust function for data
   transforms. They would live in numbered files in a new migrations directory under `src-tauri`
   directory and be included with `include_str!`, so the binary carries them.
4. **Applying.** On start, read `user_version` and apply every later migration
   in order. Each migration runs in its own transaction, and the transaction
   also sets `user_version`, so a failure leaves the version unchanged and the
   database as it was. Table rebuilds that SQLite's `ALTER TABLE` cannot express
   follow SQLite's documented twelve-step procedure: foreign keys off outside
   the transaction, rebuild, `PRAGMA foreign_key_check`, foreign keys on.
5. **Backup.** Before the first pending migration, write
   `olympus.sqlite.pre-vN.bak` beside the database with `VACUUM INTO`, which is
   consistent under WAL. Keep the last three.
6. **Newer database, older app.** If `user_version` is higher than the newest
   migration the binary knows, refuse to open the database and say so, instead
   of running old code against a schema it does not understand. This also
   closes the open "older binary against a newer database" acceptance item.
7. **Tests use the real path.** Replace the 38 `include_str!("…schema.sql")`
   test sites with one helper that opens an in-memory database through the
   migration runner, so tests exercise the same steps as the app.

## Tests that make this trustworthy

- **Fresh equals migrated.** Build a database at the frozen baseline, insert
  representative rows, apply every migration, and compare it with a database
  built fresh. Compare `sqlite_master` (normalised) and, per table,
  `PRAGMA table_info`, `index_list` and `foreign_key_list`. This is the test that
  prevents the failure class above.
- **Idempotent start.** Opening a database twice applies nothing the second
  time.
- **Failure rolls back.** A migration that fails leaves `user_version` and the
  data unchanged, and the backup exists.
- **Refusal.** A database with a higher version than the binary knows is
  refused with a clear message.
- **Each migration** that transforms data gets a test with before and after rows.

## Rules once it exists

These go into `ARCHITECTURE.md` and `AGENTS.md` when the runner lands:

- Never edit a migration that has shipped. Any change to an existing table is
  a new migration.
- A migration that drops or rewrites data needs Kevin's approval, like any
  other destructive action. The backup is recovery, not permission.
- `scripts/test-guidance-docs.mjs` or a Rust test should fail if `schema.sql`
  changes after the baseline is frozen.

## First migrations queued

1. Drop the five tables nothing reads: `tasks`, `research_items`,
   `skill_recipes`, `dashboard_modules`, `operator_briefs`. Their `CREATE`
   statements were removed from `schema.sql` on 2026-10-12, so new databases no
   longer get them, but existing databases keep them until this runs. Dropping
   them touches Kevin's real database and needs his approval at that time.
2. Optionally: point `organizer_tasks.project_id` at the project registry
   instead of the legacy `projects` table. This is a design decision, not just a
   migration.
