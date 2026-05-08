-- Migration: Standardize send_message_simulated RPC
-- Signature: send_message_simulated(p_message_id uuid, p_lead_id uuid)

-- Drop all possible overloads to ensure a clean state
DROP FUNCTION IF EXISTS public.send_message_simulated(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.send_message_simulated(uuid, uuid);

CREATE OR REPLACE FUNCTION public.send_message_simulated(p_message_id uuid, p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_current_stage_id uuid;
  v_target_stage_id uuid;
BEGIN
  -- 1. Validate authenticated user
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- 2. Get lead context and validate existence
  SELECT workspace_id, stage_id
    INTO v_workspace_id, v_current_stage_id
  FROM public.leads
  WHERE id = p_lead_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Lead not found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Validate user belongs to the workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_users 
    WHERE workspace_id = v_workspace_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- 4. Validate message belongs to the lead + workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.messages
    WHERE id = p_message_id AND lead_id = p_lead_id AND workspace_id = v_workspace_id
  ) THEN
    RAISE EXCEPTION 'Message not found for lead' USING ERRCODE = 'P0002';
  END IF;

  -- 5. Find target stage "Tentando Contato"
  SELECT id INTO v_target_stage_id
  FROM public.stages
  WHERE workspace_id = v_workspace_id AND name = 'Tentando Contato'
  LIMIT 1;

  IF v_target_stage_id IS NULL THEN
     -- Fallback: Se não encontrar exatamente esse nome, tenta 'Approach' ou similar, ou falha
     RAISE EXCEPTION 'Etapa "Tentando Contato" não encontrada no workspace' USING ERRCODE = 'P0002';
  END IF;

  -- 6. Atomic Operation
  -- A. Mark message as sent
  UPDATE public.messages
  SET status = 'sent',
      sent_at = now(),
      updated_at = now()
  WHERE id = p_message_id;

  -- B. Move lead
  UPDATE public.leads
  SET stage_id = v_target_stage_id,
      updated_at = now()
  WHERE id = p_lead_id;

  -- C. Register history (lead_events)
  INSERT INTO public.lead_events (workspace_id, lead_id, type, description, metadata)
  VALUES (
    v_workspace_id,
    p_lead_id,
    'message_sent',
    'Abordagem iniciada (Simulação de Envio).',
    jsonb_build_object('message_id', p_message_id, 'user_id', v_user_id)
  );

  IF v_current_stage_id IS DISTINCT FROM v_target_stage_id THEN
    INSERT INTO public.lead_events (workspace_id, lead_id, type, description, metadata)
    VALUES (
      v_workspace_id,
      p_lead_id,
      'stage_changed',
      'Lead movido automaticamente para Tentando Contato.',
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

-- Permissions
REVOKE EXECUTE ON FUNCTION public.send_message_simulated(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.send_message_simulated(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message_simulated(uuid, uuid) TO service_role;
