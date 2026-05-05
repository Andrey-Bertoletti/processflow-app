-- 1. EVENT SEQUENCE GLOBAL
-- Adiciona ordenamento determinístico absoluto que não depende de microsegundos do relógio
ALTER TABLE public.activities ADD COLUMN event_sequence BIGSERIAL;

-- 2. SNAPSHOT TEMPORAL DO LEAD
-- Captura o estado exato do lead no momento do evento

CREATE OR REPLACE FUNCTION public.log_lead_creation() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activities (workspace_id, lead_id, type, content, created_by)
  VALUES (
    NEW.workspace_id, NEW.id, 'lead_created', 
    jsonb_build_object(
      'name', NEW.name,
      'snapshot', row_to_json(NEW)
    ), 
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_lead_stage_change() 
RETURNS TRIGGER AS $$
DECLARE
  v_old_stage_name TEXT;
  v_new_stage_name TEXT;
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    SELECT name INTO v_old_stage_name FROM public.stages WHERE id = OLD.stage_id;
    SELECT name INTO v_new_stage_name FROM public.stages WHERE id = NEW.stage_id;

    INSERT INTO public.activities (workspace_id, lead_id, type, content, created_by)
    VALUES (
      NEW.workspace_id, NEW.id, 'stage_change', 
      jsonb_build_object(
        'old_stage_name', COALESCE(v_old_stage_name, 'Desconhecida'), 
        'new_stage_name', COALESCE(v_new_stage_name, 'Desconhecida'),
        'snapshot', row_to_json(NEW)
      ), 
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_message_creation() 
RETURNS TRIGGER AS $$
DECLARE
  v_lead_snapshot JSONB;
BEGIN
  SELECT row_to_json(l) INTO v_lead_snapshot FROM public.leads l WHERE id = NEW.lead_id;

  IF NEW.status = 'success' OR NEW.status IS NULL THEN
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

  IF OLD.status = 'pending' AND NEW.status = 'success' THEN
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
