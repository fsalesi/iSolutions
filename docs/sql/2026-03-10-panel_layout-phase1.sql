-- Phase 1: v2 panel designer persistence foundation
-- Safe to apply before any runtime integration. Zero rows are a no-op.

CREATE TABLE IF NOT EXISTS public.panel_layout (
  oid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain citext NOT NULL DEFAULT '*'::citext,
  form_key text NOT NULL,
  panel_key text NOT NULL,
  table_name text NOT NULL,
  entry_type text NOT NULL,
  entry_key text NOT NULL,
  parent_key text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS panel_layout_scope_entry_uq
  ON public.panel_layout (domain, form_key, panel_key, table_name, entry_type, entry_key);

CREATE INDEX IF NOT EXISTS panel_layout_lookup_idx
  ON public.panel_layout (form_key, panel_key, table_name, domain, entry_type, sort_order);
