-- Template for new migrations. Copy this file to `NNNN_<name>.sql`,
-- replace the placeholders, and run once in the Supabase SQL Editor.
--
-- Every new table MUST:
--   1. Enable row-level security.
--   2. Declare its policies (or note explicitly that it has none and is
--      service_role-only).
--   3. Declare explicit GRANTs for the three Supabase roles. The defaults
--      Supabase ships with are permissive; we prefer the intent to live
--      in the migration alongside the schema.
--
-- Role model in this project:
--   anon          — unauthenticated visitors hitting the site
--   authenticated — signed-in users (kept for parity, not currently used)
--   service_role  — scrapers and monitor job; bypasses RLS
--
-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------

create table if not exists public.<table_name> (
  id bigserial primary key
  -- , columns...
);

-- create index if not exists <table_name>_<col>_idx on public.<table_name> (<col>);

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------

alter table public.<table_name> enable row level security;

-- Public-read table? Uncomment and adapt:
-- drop policy if exists "Public read access" on public.<table_name>;
-- create policy "Public read access"
--   on public.<table_name>
--   for select
--   to anon, authenticated
--   using (true);
--
-- Service-role-only table? Leave with no policies. service_role bypasses
-- RLS so it can still read/write; anon/authenticated will see nothing.

-- ---------------------------------------------------------------------------
-- 3. GRANTs — required for every table
-- ---------------------------------------------------------------------------

-- Start from a clean slate so the intent below is the whole story.
revoke all on public.<table_name> from anon, authenticated;

-- Pick the row that matches this table's access model:
--
--   Public-read table:
-- grant select on public.<table_name> to anon, authenticated;
--
--   Service-role-only table: (no anon/authenticated grants)
--
-- service_role always gets full access:
grant all on public.<table_name> to service_role;

-- If the table uses a bigserial/serial primary key, also grant the
-- underlying sequence so service_role can insert without privilege errors:
-- grant usage, select on sequence public.<table_name>_id_seq to service_role;
