-- Migration: Fix send_message_simulated authorization + status semantics
-- Timestamp: 2026-05-06181000
--
-- Fixes:
-- - Prevent IDOR: ensure the caller belongs to the lead workspace
-- - Mark messages as `sent` when simulated sending happens
-- - Record lead_events for timeline (message_sent + optional stage_changed)
-- - Remove legacy overload that accepted p_user_id (unsafe with SECURITY DEFINER)

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- Drop insecure legacy overload (SECURITY DEFINER + user-controlled p_user_id)
DROP FUNCTION IF EXISTS public.send_message_simulated(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.send_message_simulated(p_message_id uuid, p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_from_stage_id uuid;
  v_target_stage_id uuid;
  v_message_content text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT workspace_id, stage_id
    INTO v_workspace_id, v_from_stage_id
  FROM public.leads
  WHERE id = p_lead_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Lead not found' USING ERRCODE = 'P0002';
  END IF;

  -- AuthZ: caller must be part of the workspace
  IF NOT public.is_user_in_workspace(v_workspace_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Validate message belongs to the lead + workspace
  SELECT content
    INTO v_message_content
  FROM public.messages
  WHERE id = p_message_id
    AND lead_id = p_lead_id
    AND workspace_id = v_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found for lead' USING ERRCODE = 'P0002';
  END IF;

  -- Find canonical stage "Tentando Contato" for this workspace (if present)
  SELECT id
    INTO v_target_stage_id
  FROM public.stages
  WHERE workspace_id = v_workspace_id
    AND name = 'Tentando Contato'
  LIMIT 1;

  -- Mark message as sent (simulated)
  UPDATE public.messages
  SET status = 'sent',
      sent_at = COALESCE(sent_at, now()),
      updated_at = now()
  WHERE id = p_message_id;

  -- Move lead to the target stage (if found)
  IF v_target_stage_id IS NOT NULL THEN
    UPDATE public.leads
    SET stage_id = v_target_stage_id,
        updated_at = now()
    WHERE id = p_lead_id;
  END IF;

  -- Timeline: message_sent event
  INSERT INTO public.lead_events (workspace_id, lead_id, type, description, metadata)
  VALUES (
    v_workspace_id,
    p_lead_id,
    'message_sent',
    'Abordagem iniciada (envio simulado).',
    jsonb_build_object('message_id', p_message_id, 'user_id', v_user_id)
  );

  -- Timeline: stage_changed event (only when we actually changed)
  IF v_target_stage_id IS NOT NULL AND v_from_stage_id IS DISTINCT FROM v_target_stage_id THEN
    INSERT INTO public.lead_events (workspace_id, lead_id, type, description, metadata)
    VALUES (
      v_workspace_id,
      p_lead_id,
      'stage_changed',
      'Lead movido automaticamente para Tentando Contato ao enviar mensagem.',
      jsonb_build_object('from_stage', v_from_stage_id, 'to_stage', v_target_stage_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_stage_id', v_target_stage_id,
    'sent_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_message_simulated(uuid, uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.send_message_simulated(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_message_simulated(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message_simulated(uuid, uuid) TO service_role;

