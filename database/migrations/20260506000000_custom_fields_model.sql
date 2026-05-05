-- Normalize workspace custom fields and store per-lead values relationally.

DO $$ 
BEGIN
    -- Rename label to name if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='workspace_custom_fields' AND column_name='label') THEN
        ALTER TABLE public.workspace_custom_fields RENAME COLUMN label TO name;
    END IF;

    -- Rename field_key to key if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='workspace_custom_fields' AND column_name='field_key') THEN
        ALTER TABLE public.workspace_custom_fields RENAME COLUMN field_key TO key;
    END IF;

    -- Add columns if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='workspace_custom_fields' AND column_name='required') THEN
        ALTER TABLE public.workspace_custom_fields ADD COLUMN required boolean NOT NULL DEFAULT false;
    END IF;
END $$;

ALTER TABLE public.workspace_custom_fields
    ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.workspace_custom_fields
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.workspace_custom_fields
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.workspace_custom_fields
SET updated_at = now()
WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS update_workspace_custom_fields_updated_at ON public.workspace_custom_fields;

CREATE TRIGGER update_workspace_custom_fields_updated_at
BEFORE UPDATE ON public.workspace_custom_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS workspace_custom_fields_workspace_key_idx
    ON public.workspace_custom_fields (workspace_id, key);

DROP POLICY IF EXISTS "Users can view custom fields of their workspaces" ON public.workspace_custom_fields;
DROP POLICY IF EXISTS "Workspace admins can manage custom fields" ON public.workspace_custom_fields;

CREATE POLICY "Users can view custom fields of their workspaces"
    ON public.workspace_custom_fields
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.workspace_users
            WHERE workspace_users.workspace_id = workspace_custom_fields.workspace_id
              AND workspace_users.user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace admins can manage custom fields"
    ON public.workspace_custom_fields
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.workspace_users
            WHERE workspace_users.workspace_id = workspace_custom_fields.workspace_id
              AND workspace_users.user_id = auth.uid()
              AND workspace_users.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.workspace_users
            WHERE workspace_users.workspace_id = workspace_custom_fields.workspace_id
              AND workspace_users.user_id = auth.uid()
              AND workspace_users.role IN ('owner', 'admin')
        )
    );

CREATE TABLE IF NOT EXISTS public.lead_custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    custom_field_id UUID NOT NULL REFERENCES public.workspace_custom_fields(id) ON DELETE CASCADE,
    value JSONB NOT NULL DEFAULT 'null'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (lead_id, custom_field_id)
);

ALTER TABLE public.lead_custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lead_custom_field_values_lead_id
    ON public.lead_custom_field_values (lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_custom_field_values_custom_field_id
    ON public.lead_custom_field_values (custom_field_id);

DROP TRIGGER IF EXISTS update_lead_custom_field_values_updated_at ON public.lead_custom_field_values;

CREATE TRIGGER update_lead_custom_field_values_updated_at
BEFORE UPDATE ON public.lead_custom_field_values
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can view lead custom field values" ON public.lead_custom_field_values;
DROP POLICY IF EXISTS "Users can manage lead custom field values" ON public.lead_custom_field_values;

CREATE POLICY "Users can view lead custom field values"
    ON public.lead_custom_field_values
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.leads
            WHERE leads.id = lead_custom_field_values.lead_id
              AND public.is_user_in_workspace(leads.workspace_id)
        )
        AND EXISTS (
            SELECT 1
            FROM public.workspace_custom_fields
            WHERE workspace_custom_fields.id = lead_custom_field_values.custom_field_id
              AND public.is_user_in_workspace(workspace_custom_fields.workspace_id)
        )
    );

CREATE POLICY "Users can manage lead custom field values"
    ON public.lead_custom_field_values
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.leads
            WHERE leads.id = lead_custom_field_values.lead_id
              AND public.is_user_in_workspace(leads.workspace_id)
        )
        AND EXISTS (
            SELECT 1
            FROM public.workspace_custom_fields
            WHERE workspace_custom_fields.id = lead_custom_field_values.custom_field_id
              AND public.is_user_in_workspace(workspace_custom_fields.workspace_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.leads
            WHERE leads.id = lead_custom_field_values.lead_id
              AND public.is_user_in_workspace(leads.workspace_id)
        )
        AND EXISTS (
            SELECT 1
            FROM public.workspace_custom_fields
            WHERE workspace_custom_fields.id = lead_custom_field_values.custom_field_id
              AND public.is_user_in_workspace(workspace_custom_fields.workspace_id)
        )
    );

CREATE OR REPLACE FUNCTION public.validate_stage_requirements()
RETURNS trigger AS $$
DECLARE
  v_required jsonb;
  v_rule jsonb;
  v_stage_name text;
  v_new_json jsonb := to_jsonb(NEW);
  v_old_json jsonb := to_jsonb(OLD);
  v_required_value text;
BEGIN
  SELECT coalesce(required_fields, '[]'::jsonb), name
  INTO v_required, v_stage_name
  FROM public.stages
  WHERE id = NEW.stage_id;

  IF v_required IS NULL OR jsonb_array_length(v_required) = 0 THEN
    RETURN NEW;
  END IF;

  FOR v_rule IN SELECT jsonb_array_elements(v_required) LOOP
    IF v_rule ? 'custom_field_id' THEN
      v_required_value := lower(trim(both '"' from coalesce(
        v_new_json -> 'metadata' ->> (v_rule->>'custom_field_id'),
        v_old_json -> 'metadata' ->> (v_rule->>'custom_field_id'),
        ''
      )));

      IF v_required_value IS NULL OR v_required_value = '' OR v_required_value = 'null' THEN
        v_required_value := lower(trim(both '"' from coalesce(
          (SELECT value::text
           FROM public.lead_custom_field_values
           WHERE lead_id = NEW.id
             AND custom_field_id = (v_rule->>'custom_field_id')::uuid
           LIMIT 1),
          ''
        )));
      END IF;

      IF v_required_value IS NULL OR v_required_value = '' OR v_required_value = 'null' THEN
        RAISE EXCEPTION USING
          MESSAGE = 'VALIDATION_ERROR',
          DETAIL = v_rule->>'custom_field_id',
          HINT = 'Required custom field missing: ' || coalesce(v_rule->>'label', v_rule->>'custom_field_id');
      END IF;
    ELSE
      v_required_value := coalesce(v_new_json ->> (v_rule->>'field'), v_old_json ->> (v_rule->>'field'));

      IF v_required_value IS NULL OR trim(v_required_value) = '' THEN
        RAISE EXCEPTION USING
          MESSAGE = 'VALIDATION_ERROR',
          DETAIL = v_rule->>'field',
          HINT = 'Required field missing: ' || coalesce(v_rule->>'label', v_rule->>'field');
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_stage ON public.leads;

CREATE TRIGGER trg_validate_stage
BEFORE UPDATE ON public.leads
FOR EACH ROW
WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
EXECUTE FUNCTION public.validate_stage_requirements();
