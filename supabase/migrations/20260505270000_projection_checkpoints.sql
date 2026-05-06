-- ==========================================
-- 1. STREAM PROCESSOR CHECKPOINTS
-- ==========================================
-- Removemos a mutabilidade do Event Log (O log volta a ser 100% imutável)
ALTER TABLE public.job_events DROP COLUMN IF EXISTS is_processed;
ALTER TABLE public.job_events DROP COLUMN IF EXISTS processed_at;
DROP INDEX IF EXISTS idx_job_events_unprocessed;

-- Tabela que gerencia o estado de consumo de cada Projection (Stream Checkpointing)
CREATE TABLE IF NOT EXISTS public.projection_checkpoints (
  projection_name TEXT PRIMARY KEY,
  last_event_created_at TIMESTAMP WITH TIME ZONE DEFAULT '1970-01-01 00:00:00+00',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserimos os três workers paralelos independentes
INSERT INTO public.projection_checkpoints (projection_name) VALUES 
('lead_timeline_v1'),
('workspace_metrics_v1'),
('campaign_performance_v1')
ON CONFLICT DO NOTHING;

-- ==========================================
-- 2. VERSIONAMENTO DE READ MODELS (V1)
-- ==========================================
-- A. LEAD TIMELINE VIEW (V1)
CREATE TABLE IF NOT EXISTS public.v1_read_lead_timeline (
  lead_id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  current_stage_id UUID,
  last_job_status TEXT, 
  total_ai_messages INT DEFAULT 0,
  last_ai_response TEXT,
  last_error_log TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- B. WORKSPACE METRICS VIEW (V1)
CREATE TABLE IF NOT EXISTS public.v1_read_workspace_metrics (
  workspace_id UUID NOT NULL,
  date_key DATE NOT NULL DEFAULT CURRENT_DATE,
  total_jobs_processed INT DEFAULT 0,
  total_jobs_failed INT DEFAULT 0,
  total_tokens_consumed INT DEFAULT 0,
  avg_latency_ms INT DEFAULT 0,
  PRIMARY KEY (workspace_id, date_key)
);

-- C. CAMPAIGN PERFORMANCE VIEW (V1)
CREATE TABLE IF NOT EXISTS public.v1_read_campaign_performance (
  campaign_id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  leads_processed INT DEFAULT 0,
  successful_generations INT DEFAULT 0,
  failed_generations INT DEFAULT 0,
  avg_confidence NUMERIC(3, 2) DEFAULT 0.00
);

-- D. Migração de dados legados (caso existam) para as novas V1
INSERT INTO public.v1_read_lead_timeline SELECT * FROM public.read_lead_timeline ON CONFLICT DO NOTHING;
INSERT INTO public.v1_read_workspace_metrics SELECT * FROM public.read_workspace_metrics ON CONFLICT DO NOTHING;
INSERT INTO public.v1_read_campaign_performance SELECT * FROM public.read_campaign_performance ON CONFLICT DO NOTHING;

-- Drop das tabelas velhas (sem versionamento)
DROP TABLE IF EXISTS public.read_lead_timeline;
DROP TABLE IF EXISTS public.read_workspace_metrics;
DROP TABLE IF EXISTS public.read_campaign_performance;

-- Ativa RLS nas novas models
ALTER TABLE public.v1_read_lead_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v1_read_workspace_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v1_read_campaign_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace Isolation Read Lead V1" ON public.v1_read_lead_timeline FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid()));
CREATE POLICY "Workspace Isolation Read Metrics V1" ON public.v1_read_workspace_metrics FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid()));
CREATE POLICY "Workspace Isolation Read Campaign V1" ON public.v1_read_campaign_performance FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid()));


-- ==========================================
-- 3. HELPER: ATOMIC CHECKPOINT ADVANCE
-- ==========================================
-- Função usada pelos Projection Workers para avançar o checkpoint do stream
CREATE OR REPLACE FUNCTION public.advance_projection_checkpoint(p_projection_name TEXT, p_last_timestamp TIMESTAMP WITH TIME ZONE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.projection_checkpoints
  SET last_event_created_at = p_last_timestamp,
      updated_at = now()
  WHERE projection_name = p_projection_name
    AND last_event_created_at < p_last_timestamp; -- Impede recuo acidental
END;
$$;
