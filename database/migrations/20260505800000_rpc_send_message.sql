-- Migration: Atomic function to send message and move lead
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
    v_result JSONB;
BEGIN
    -- 1. Obter workspace do lead
    SELECT workspace_id INTO v_workspace_id FROM public.leads WHERE id = p_lead_id;
    
    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Lead nao encontrado';
    END IF;

    -- 2. Localizar etapa de "Contato" (priorizando nome ou ordem)
    SELECT id INTO v_target_stage_id 
    FROM public.stages 
    WHERE workspace_id = v_workspace_id 
    AND (name ILIKE '%contato%' OR name ILIKE '%approach%' OR name ILIKE '%mensag%')
    ORDER BY "order" ASC 
    LIMIT 1;

    -- Se nao achar etapa especifica, nao movemos, apenas enviamos
    
    -- 3. Inserir a mensagem
    INSERT INTO public.messages (workspace_id, lead_id, campaign_id, content, status, is_automated)
    VALUES (v_workspace_id, p_lead_id, p_campaign_id, p_content, 'sent', true);

    -- 4. Mover o lead se encontramos a etapa
    IF v_target_stage_id IS NOT NULL THEN
        UPDATE public.leads 
        SET stage_id = v_target_stage_id, 
            updated_at = now()
        WHERE id = p_lead_id;
    END IF;

    -- 5. Registrar Atividade
    INSERT INTO public.activities (workspace_id, lead_id, type, description)
    VALUES (v_workspace_id, p_lead_id, 'message_sent', 'Mensagem gerada por IA enviada via sistema.');

    RETURN jsonb_build_object(
        'success', true,
        'moved_to_stage', v_target_stage_id
    );
END;
$$;
