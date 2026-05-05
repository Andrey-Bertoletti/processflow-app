-- ==========================================
-- FASE 8: TIMELINE DE ATIVIDADES DO LEAD (FIXED)
-- ==========================================

-- 0. GARANTE ESTRUTURA BASE (FIX)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='status') THEN
    ALTER TABLE public.messages ADD COLUMN status TEXT DEFAULT 'success';
  END IF;
END $$;

-- 1. Tabela central de Histórico
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('lead_created', 'stage_change', 'ai_message', 'manual_message', 'note')),
  content JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Workspace Isolation Activities') THEN
    CREATE POLICY "Workspace Isolation Activities" 
    ON public.activities FOR ALL 
    USING (workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid()));
  END IF;
END $$;

-- 2. CAPTURA DE EVENTOS (FUNCTIONS)

CREATE OR REPLACE FUNCTION public.log_lead_creation() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activities (workspace_id, lead_id, type, content, created_by)
  VALUES (NEW.workspace_id, NEW.id, 'lead_created', jsonb_build_object('name', NEW.name), auth.uid());
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
    VALUES (NEW.workspace_id, NEW.id, 'stage_change', 
      jsonb_build_object('old_stage_name', COALESCE(v_old_stage_name, 'Desconhecida'), 'new_stage_name', COALESCE(v_new_stage_name, 'Desconhecida')), 
      auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_message_creation() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' OR NEW.status IS NULL THEN
    INSERT INTO public.activities (workspace_id, lead_id, type, content, created_by)
    VALUES (NEW.workspace_id, NEW.lead_id, CASE WHEN NEW.is_automated THEN 'ai_message' ELSE 'manual_message' END, jsonb_build_object('content', NEW.content), auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_message_update() 
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'success' THEN
    INSERT INTO public.activities (workspace_id, lead_id, type, content, created_by)
    VALUES (NEW.workspace_id, NEW.lead_id, CASE WHEN NEW.is_automated THEN 'ai_message' ELSE 'manual_message' END, jsonb_build_object('content', NEW.content), NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RECRIAÇÃO DOS TRIGGERS (BLINDAGEM)

DROP TRIGGER IF EXISTS trg_log_lead_creation ON public.leads;
CREATE TRIGGER trg_log_lead_creation AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_lead_creation();

DROP TRIGGER IF EXISTS trg_log_lead_stage_change ON public.leads;
CREATE TRIGGER trg_log_lead_stage_change AFTER UPDATE OF stage_id ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_lead_stage_change();

DROP TRIGGER IF EXISTS trg_log_message_creation ON public.messages;
CREATE TRIGGER trg_log_message_creation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.log_message_creation();

DROP TRIGGER IF EXISTS trg_log_message_update ON public.messages;
CREATE TRIGGER trg_log_message_update AFTER UPDATE OF status ON public.messages FOR EACH ROW EXECUTE FUNCTION public.log_message_update();
