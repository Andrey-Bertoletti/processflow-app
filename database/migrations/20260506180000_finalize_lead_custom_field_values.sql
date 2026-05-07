-- Migration: Finalize lead_custom_field_values schema (workspace_id + jsonb)
-- Timestamp: 2026-05-06180000
--
-- Goals (forward-only hardening):
-- - Normalize `public.lead_custom_field_values` to include `workspace_id` (NOT NULL)
-- - Keep `value` as `jsonb` (convert from text safely when needed)
-- - Ensure `id` primary key exists
-- - Enforce uniqueness (lead_id, custom_field_id)
-- - Add useful indexes + RLS policies + updated_at trigger

-- 1) Ensure base columns exist (legacy-safe)
ALTER TABLE public.lead_custom_field_values
  ADD COLUMN IF NOT EXISTS id uuid;

ALTER TABLE public.lead_custom_field_values
  ADD COLUMN IF NOT EXISTS workspace_id uuid;

ALTER TABLE public.lead_custom_field_values
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.lead_custom_field_values
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- 2) Backfill primary key if needed
UPDATE public.lead_custom_field_values
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.lead_custom_field_values
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.lead_custom_field_values
  ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.lead_custom_field_values
    ADD CONSTRAINT lead_custom_field_values_pkey PRIMARY KEY (id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3) Backfill workspace_id from leads (for legacy rows)
UPDATE public.lead_custom_field_values v
SET workspace_id = l.workspace_id
FROM public.leads l
WHERE v.workspace_id IS NULL
  AND v.lead_id = l.id;

-- Remove any orphan rows that still can't be associated to a workspace
DELETE FROM public.lead_custom_field_values
WHERE workspace_id IS NULL;

-- 4) Ensure timestamps are populated + defaults set
UPDATE public.lead_custom_field_values
SET created_at = now()
WHERE created_at IS NULL;

UPDATE public.lead_custom_field_values
SET updated_at = now()
WHERE updated_at IS NULL;

ALTER TABLE public.lead_custom_field_values
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.lead_custom_field_values
  ALTER COLUMN updated_at SET DEFAULT now();

-- 5) Enforce workspace_id NOT NULL (after backfill)
ALTER TABLE public.lead_custom_field_values
  ALTER COLUMN workspace_id SET NOT NULL;

-- 6) Ensure foreign keys exist (safe via exception handler)
DO $$
BEGIN
  ALTER TABLE public.lead_custom_field_values
    ADD CONSTRAINT lead_custom_field_values_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lead_custom_field_values
    ADD CONSTRAINT lead_custom_field_values_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lead_custom_field_values
    ADD CONSTRAINT lead_custom_field_values_custom_field_id_fkey
    FOREIGN KEY (custom_field_id) REFERENCES public.workspace_custom_fields(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 7) Normalize `value` type to jsonb.
-- If currently text/varchar, convert to jsonb string via `to_jsonb(value)`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lead_custom_field_values'
      AND column_name = 'value'
      AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE public.lead_custom_field_values
      ALTER COLUMN value TYPE jsonb
      USING to_jsonb(value);
  END IF;
END $$;

ALTER TABLE public.lead_custom_field_values
  ADD COLUMN IF NOT EXISTS value jsonb;

-- Allow NULL values (matches frontend behavior: empty strings -> null)
ALTER TABLE public.lead_custom_field_values
  ALTER COLUMN value DROP NOT NULL;

-- 8) Ensure uniqueness (lead_id, custom_field_id)
DO $$
BEGIN
  ALTER TABLE public.lead_custom_field_values
    ADD CONSTRAINT lead_custom_field_values_lead_custom_field_key UNIQUE (lead_id, custom_field_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 9) Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_lead_custom_field_values_workspace_id
  ON public.lead_custom_field_values (workspace_id);

CREATE INDEX IF NOT EXISTS idx_lead_custom_field_values_lead_id
  ON public.lead_custom_field_values (lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_custom_field_values_custom_field_id
  ON public.lead_custom_field_values (custom_field_id);

-- 10) Trigger for updated_at
DROP TRIGGER IF EXISTS update_lead_custom_field_values_updated_at ON public.lead_custom_field_values;
CREATE TRIGGER update_lead_custom_field_values_updated_at
BEFORE UPDATE ON public.lead_custom_field_values
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 11) RLS policies (workspace-scoped)
ALTER TABLE public.lead_custom_field_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage custom field values in their workspace" ON public.lead_custom_field_values;
DROP POLICY IF EXISTS "Users can view custom field values from their workspace" ON public.lead_custom_field_values;
DROP POLICY IF EXISTS "Users can view lead custom field values" ON public.lead_custom_field_values;
DROP POLICY IF EXISTS "Users can manage lead custom field values" ON public.lead_custom_field_values;
DROP POLICY IF EXISTS lead_custom_field_values_select ON public.lead_custom_field_values;
DROP POLICY IF EXISTS lead_custom_field_values_manage ON public.lead_custom_field_values;

CREATE POLICY lead_custom_field_values_select
  ON public.lead_custom_field_values
  FOR SELECT
  USING (public.is_user_in_workspace(workspace_id));

CREATE POLICY lead_custom_field_values_manage
  ON public.lead_custom_field_values
  FOR ALL
  USING (public.is_user_in_workspace(workspace_id))
  WITH CHECK (public.is_user_in_workspace(workspace_id));

