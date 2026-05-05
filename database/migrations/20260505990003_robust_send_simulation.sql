-- Migration: Robust Message Sending Simulation
-- Adds sent_at and creates a transactional RPC for approach initiation

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.send_message_simulated(
    p_message_id UUID,
    p_lead_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workspace_id UUID;
    v_target_stage_id UUID;
    v_current_stage_id UUID;
    v_campaign_id UUID;
BEGIN
    -- 1. Validação de Existência e Workspace
    SELECT workspace_id, stage_id, campaign_id INTO v_workspace_id, v_current_stage_id, v_campaign_id
    FROM public.leads 
    WHERE id = p_lead_id;

    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Lead nao encontrado';
    END IF;

    -- 2. Validação da Mensagem
    IF NOT EXISTS (SELECT 1 FROM public.messages WHERE id = p_message_id AND lead_id = p_lead_id) THEN
        RAISE EXCEPTION 'Mensagem nao pertence ao lead selecionado';
    END IF;

    -- 3. Localizar Etapa Canônica "Tentando Contato"
    SELECT id INTO v_target_stage_id 
    FROM public.stages 
    WHERE workspace_id = v_workspace_id 
    AND name = 'Tentando Contato'
    LIMIT 1;

    IF v_target_stage_id IS NULL THEN
        RAISE EXCEPTION 'Etapa canonica "Tentando Contato" nao encontrada neste workspace';
    END IF;

    -- 4. OPERAÇÃO ATÔMICA
    -- A. Marcar Mensagem como Enviada
    UPDATE public.messages 
    SET status = 'sent', 
        sent_at = now(),
        updated_at = now()
    WHERE id = p_message_id;

    -- B. Mover Lead de Etapa
    UPDATE public.leads 
    SET stage_id = v_target_stage_id,
        updated_at = now()
    WHERE id = p_lead_id;

    -- C. Registrar Evento: Mensagem Enviada
    INSERT INTO public.lead_events (workspace_id, lead_id, type, description, metadata)
    VALUES (
        v_workspace_id, 
        p_lead_id, 
        'message_sent', 
        'Abordagem iniciada via IA.', 
        jsonb_build_object('message_id', p_message_id, 'user_id', p_user_id)
    );

    -- D. Registrar Evento: Mudança de Etapa
    IF v_current_stage_id <> v_target_stage_id THEN
        INSERT INTO public.lead_events (workspace_id, lead_id, type, description, metadata)
        VALUES (
            v_workspace_id, 
            p_lead_id, 
            'stage_changed', 
            'Lead movido automaticamente para Tentando Contato ao enviar mensagem.', 
            jsonb_build_object('from_stage', v_current_stage_id, 'to_stage', v_target_stage_id)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'new_stage_id', v_target_stage_id,
        'sent_at', now()
    );
END;
$$;
