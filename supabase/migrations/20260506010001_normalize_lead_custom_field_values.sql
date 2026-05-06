-- Migration: Normalize Lead Custom Field Values
-- Timestamp: 2026-05-06010001

CREATE TABLE IF NOT EXISTS public.lead_custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    custom_field_id UUID NOT NULL REFERENCES public.workspace_custom_fields(id) ON DELETE CASCADE,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(lead_id, custom_field_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_custom_field_values_lead_id ON public.lead_custom_field_values(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_custom_field_values_custom_field_id ON public.lead_custom_field_values(custom_field_id);

ALTER TABLE public.lead_custom_field_values ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Users can view custom field values from their workspace'
    ) THEN
        CREATE POLICY "Users can view custom field values from their workspace"
        ON public.lead_custom_field_values
        FOR SELECT
        USING (
            workspace_id IN (
                SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid()
            )
        );
    END IF;
END $$;
