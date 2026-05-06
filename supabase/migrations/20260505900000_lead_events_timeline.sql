-- Migration: Create lead_events table and Update RPC
CREATE TABLE IF NOT EXISTS public.lead_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g., 'message_sent', 'stage_change', 'note_added'
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

-- Política de visualização
CREATE POLICY "Users can view events of their workspace leads"
    ON public.lead_events FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.workspace_users 
        WHERE workspace_users.workspace_id = lead_events.workspace_id 
        AND workspace_users.user_id = auth.uid()
    ));

-- Atualizar a RPC para usar esta tabela e incluir o conteúdo real
CREATE OR REPLACE FUNCTION public.send_message_and_move_lead(
    p_lead_id UUID,
    p_content TEXT,
    p_campaign_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workspace_id UUID;
    v_target_stage_id UUID;
BEGIN
    SELECT workspace_id INTO v_workspace_id FROM public.leads WHERE id = p_lead_id;
    
    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Lead nao encontrado';
    END IF;

    -- Localizar etapa de contato
    SELECT id INTO v_target_stage_id 
    FROM public.stages 
    WHERE workspace_id = v_workspace_id 
    AND (name ILIKE '%contato%' OR name ILIKE '%approach%')
    ORDER BY "order" ASC 
    LIMIT 1;

    -- 1. Registrar a mensagem
    INSERT INTO public.messages (workspace_id, lead_id, campaign_id, content, status, is_automated)
    VALUES (v_workspace_id, p_lead_id, p_campaign_id, p_content, 'sent', true);

    -- 2. Mover o lead (opcional)
    IF v_target_stage_id IS NOT NULL THEN
        UPDATE public.leads SET stage_id = v_target_stage_id WHERE id = p_lead_id;
    END IF;

    -- 3. REGISTRAR NO HISTÓRICO (lead_events) - SEU REQUISITO
    INSERT INTO public.lead_events (workspace_id, lead_id, type, description)
    VALUES (v_workspace_id, p_lead_id, 'message_sent', p_content);

    RETURN jsonb_build_object('success', true);
END;
$$;
