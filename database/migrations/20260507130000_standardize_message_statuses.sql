-- Migration: Standardize message statuses
-- Timestamp: 2026-05-07130000
--
-- Objective: Rename 'success' -> 'generated' and 'error' -> 'failed' for public.messages.status.
-- Keeps 'success' in ai_generations and job_queue as per request.

-- 1. Update existing records
UPDATE public.messages SET status = 'generated' WHERE status = 'success';
UPDATE public.messages SET status = 'failed' WHERE status = 'error';

-- 2. Update default value for future records
ALTER TABLE public.messages ALTER COLUMN status SET DEFAULT 'generated';

-- 3. Update Triggers to reflect new status names
-- This ensures activities/timeline continue working with the new status
CREATE OR REPLACE FUNCTION public.log_message_creation() 
RETURNS TRIGGER AS $$
DECLARE
  v_lead_snapshot JSONB;
BEGIN
  SELECT row_to_json(l) INTO v_lead_snapshot FROM public.leads l WHERE id = NEW.lead_id;

  -- Logic: Log when message is 'generated' (AI) or 'sent' (Simulation) or manual (NULL status usually)
  IF NEW.status IN ('generated', 'sent') OR NEW.status IS NULL THEN
    INSERT INTO public.activities (workspace_id, lead_id, type, content, created_by)
    VALUES (
      NEW.workspace_id, NEW.lead_id, 
      CASE WHEN NEW.is_automated THEN 'ai_message' ELSE 'manual_message' END, 
      jsonb_build_object(
        'content', NEW.content,
        'snapshot', v_lead_snapshot
      ), 
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_message_update() 
RETURNS TRIGGER AS $$
DECLARE
  v_lead_snapshot JSONB;
BEGIN
  SELECT row_to_json(l) INTO v_lead_snapshot FROM public.leads l WHERE id = NEW.lead_id;

  -- Logic: Log when transition from 'pending' (placeholder) to 'generated' (AI complete)
  IF OLD.status = 'pending' AND NEW.status = 'generated' THEN
    INSERT INTO public.activities (workspace_id, lead_id, type, content, created_by)
    VALUES (
      NEW.workspace_id, NEW.lead_id, 
      CASE WHEN NEW.is_automated THEN 'ai_message' ELSE 'manual_message' END, 
      jsonb_build_object(
        'content', NEW.content,
        'snapshot', v_lead_snapshot
      ), 
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
