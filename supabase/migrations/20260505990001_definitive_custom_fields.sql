-- Migration: Definitve Lead Custom Fields (Relational Model)
-- Refines existing workspace_custom_fields and adds lead_custom_field_values

-- 1. Refine definitions table
ALTER TABLE public.workspace_custom_fields 
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb; -- For select types

-- 2. Create values table
CREATE TABLE IF NOT EXISTS public.lead_custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    custom_field_id UUID NOT NULL REFERENCES public.workspace_custom_fields(id) ON DELETE CASCADE,
    value TEXT, -- We store as text and cast in UI/IA
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(lead_id, custom_field_id)
);

-- GARANTIR COLUNA WORKSPACE_ID SE A TABELA JÁ EXISTIA
ALTER TABLE public.lead_custom_field_values 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 3. Enable RLS
ALTER TABLE public.lead_custom_field_values ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY "Users can manage custom field values in their workspace"
    ON public.lead_custom_field_values
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_users
            WHERE workspace_users.workspace_id = lead_custom_field_values.workspace_id
            AND workspace_users.user_id = auth.uid()
        )
    );

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_custom_value_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_custom_field_values_timestamp
    BEFORE UPDATE ON public.lead_custom_field_values
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_value_timestamp();
