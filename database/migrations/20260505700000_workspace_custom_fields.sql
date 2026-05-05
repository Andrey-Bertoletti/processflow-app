-- Migration: Implement Workspace Custom Fields
CREATE TABLE IF NOT EXISTS public.workspace_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    field_key TEXT NOT NULL, -- e.g., 'cpf', 'company_size'
    field_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'number', 'select'
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, field_key)
);

-- Enable RLS
ALTER TABLE public.workspace_custom_fields ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view custom fields of their workspaces"
    ON public.workspace_custom_fields
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_users
            WHERE workspace_users.workspace_id = workspace_custom_fields.workspace_id
            AND workspace_users.user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace admins can manage custom fields"
    ON public.workspace_custom_fields
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_users
            WHERE workspace_users.workspace_id = workspace_custom_fields.workspace_id
            AND workspace_users.user_id = auth.uid()
            AND workspace_users.role IN ('owner', 'admin')
        )
    );

-- Add sample custom field for new workspaces (optional trigger could go here)
