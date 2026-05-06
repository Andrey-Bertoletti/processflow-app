-- Migration: Secure Send Message Simulation
-- Timestamp: 2026-05-06010000

CREATE OR REPLACE FUNCTION public.send_message_simulated(p_message_id uuid, p_lead_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_message_content text;
  v_workspace_id uuid;
  v_target_stage_id uuid;
BEGIN
  -- 1. Validação de Autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- 2. Busca e validação da mensagem
  SELECT content, workspace_id INTO v_message_content, v_workspace_id
  FROM public.messages
  WHERE id = p_message_id AND lead_id = p_lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or does not belong to this lead' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Busca a etapa "Tentando Contato" do workspace
  SELECT id INTO v_target_stage_id
  FROM public.stages
  WHERE workspace_id = v_workspace_id AND name = 'Tentando Contato'
  LIMIT 1;

  -- 4. Atualiza o lead para a nova etapa
  IF v_target_stage_id IS NOT NULL THEN
    UPDATE public.leads
    SET stage_id = v_target_stage_id,
        updated_at = now()
    WHERE id = p_lead_id;
  END IF;

  -- 5. Registra o envio (Simulado)
  UPDATE public.messages
  SET status = 'success',
      updated_at = now()
  WHERE id = p_message_id;

  -- 6. Log de Atividade
  INSERT INTO public.activities (lead_id, workspace_id, type, content)
  VALUES (p_lead_id, v_workspace_id, 'manual_message', jsonb_build_object(
    'message_id', p_message_id,
    'content', v_message_content,
    'status', 'sent_simulated'
  ));

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Mensagem enviada e lead movido para Tentando Contato',
    'new_stage_id', v_target_stage_id
  );
END;
$$;
