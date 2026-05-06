-- ==========================================
-- 1. CQRS ENHANCEMENT NO EVENT LOG
-- ==========================================
-- Garantimos os identificadores causais e marcação de processamento na tabela imutável
ALTER TABLE public.job_events
ADD COLUMN correlation_id UUID, -- Representa o "Lead Journey"
ADD COLUMN causation_id UUID,   -- Representa o ID do evento que engatilhou este
ADD COLUMN is_processed BOOLEAN DEFAULT false,
ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;

-- Index rápido para a Projection Engine varrer eventos novos e ordenar cronologicamente
CREATE INDEX IF NOT EXISTS idx_job_events_unprocessed 
ON public.job_events (created_at ASC) 
WHERE is_processed = false;

-- Atualizamos a trigger do log_job_event para rastrear causation e correlation (Retrocompatibilidade)
CREATE OR REPLACE FUNCTION public.log_job_event()
RETURNS TRIGGER AS $$
DECLARE
  v_correlation_id UUID;
  v_causation_id UUID;
BEGIN
  -- A Correlação é baseada no Lead (Lead Journey). 
  -- Se o payload contiver lead_id, ele é o correlation_id
  v_correlation_id := (NEW.payload->>'lead_id')::UUID;
  
  -- Se for um UPDATE (estado mudou), o causation_id é o ID do evento 'job_created' original ou o anterior
  SELECT id INTO v_causation_id 
  FROM public.job_events 
  WHERE job_id = NEW.id 
  ORDER BY created_at DESC LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.job_events (job_id, correlation_id, causation_id, event_type, details) 
    VALUES (NEW.id, v_correlation_id, v_causation_id, 'job_created', jsonb_build_object('payload', NEW.payload));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'pending' AND NEW.status = 'processing' THEN
      INSERT INTO public.job_events (job_id, correlation_id, causation_id, event_type, trace_id, details) 
      VALUES (NEW.id, v_correlation_id, v_causation_id, 'job_claimed', NEW.trace_id, jsonb_build_object('worker_id', NEW.locked_by));
    ELSIF OLD.status = 'processing' AND NEW.status = 'completed' THEN
      INSERT INTO public.job_events (job_id, correlation_id, causation_id, event_type, trace_id) 
      VALUES (NEW.id, v_correlation_id, v_causation_id, 'job_completed', NEW.trace_id);
    ELSIF OLD.status = 'processing' AND NEW.status = 'pending' THEN
      INSERT INTO public.job_events (job_id, correlation_id, causation_id, event_type, trace_id, details) 
      VALUES (NEW.id, v_correlation_id, v_causation_id, 'job_retried', NEW.trace_id, jsonb_build_object('reason', NEW.error_log, 'next_retry_at', NEW.next_retry_at));
    ELSIF OLD.status = 'processing' AND NEW.status = 'failed' THEN
      INSERT INTO public.job_events (job_id, correlation_id, causation_id, event_type, trace_id, details) 
      VALUES (NEW.id, v_correlation_id, v_causation_id, 'job_failed', NEW.trace_id, jsonb_build_object('error', NEW.error_log));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 2. READ MODELS (MATERIALIZED VIEWS / TABLES)
-- ==========================================

-- A. LEAD TIMELINE VIEW (Jornada Completa do Lead)
CREATE TABLE IF NOT EXISTS public.read_lead_timeline (
  lead_id UUID PRIMARY KEY, -- Idempotent by Lead
  workspace_id UUID NOT NULL,
  current_stage_id UUID,
  last_job_status TEXT, -- pending, processing, completed, failed
  total_ai_messages INT DEFAULT 0,
  last_ai_response TEXT,
  last_error_log TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- B. WORKSPACE METRICS VIEW (Agregação de Negócio e Custos)
CREATE TABLE IF NOT EXISTS public.read_workspace_metrics (
  workspace_id UUID NOT NULL,
  date_key DATE NOT NULL DEFAULT CURRENT_DATE,
  total_jobs_processed INT DEFAULT 0,
  total_jobs_failed INT DEFAULT 0,
  total_tokens_consumed INT DEFAULT 0,
  avg_latency_ms INT DEFAULT 0,
  PRIMARY KEY (workspace_id, date_key)
);

-- C. CAMPAIGN PERFORMANCE VIEW (Efetividade do Funil)
CREATE TABLE IF NOT EXISTS public.read_campaign_performance (
  campaign_id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  leads_processed INT DEFAULT 0,
  successful_generations INT DEFAULT 0,
  failed_generations INT DEFAULT 0,
  avg_confidence NUMERIC(3, 2) DEFAULT 0.00
);

-- Ativa RLS para as read models (A UI vai bater AQUI)
ALTER TABLE public.read_lead_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_workspace_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_campaign_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace Isolation Read Lead Timeline" ON public.read_lead_timeline FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid()));
CREATE POLICY "Workspace Isolation Read Metrics" ON public.read_workspace_metrics FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid()));
CREATE POLICY "Workspace Isolation Read Campaign" ON public.read_campaign_performance FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid()));


-- ==========================================
-- 3. PROJECTION ENGINE: DB REBUILD HELPER
-- ==========================================
-- Função atômica que a Projection Engine chama quando solicitar um "Rebuild Total"
-- Isso TRUNCA os read models e marca todos os eventos como "Não Processados"
CREATE OR REPLACE FUNCTION public.cqrs_reset_projections()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Destrói o estado derivado atual das views Versionadas
  TRUNCATE TABLE public.v1_read_lead_timeline;
  TRUNCATE TABLE public.v1_read_workspace_metrics;
  TRUNCATE TABLE public.v1_read_campaign_performance;

  -- 2. Reseta os Checkpoints dos Stream Processors
  UPDATE public.projection_checkpoints 
  SET last_event_created_at = '1970-01-01 00:00:00+00',
      updated_at = now();
END;
$$;
