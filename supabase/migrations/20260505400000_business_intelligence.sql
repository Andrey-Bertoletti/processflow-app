-- FASE 10: BUSINESS INTELLIGENCE & AI DECISION ENGINE

-- 1. Criação da tabela de Insights
CREATE TABLE IF NOT EXISTS public.lead_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE UNIQUE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    score INT DEFAULT 50 CHECK (score >= 0 AND score <= 100),
    sentiment TEXT DEFAULT 'cold' CHECK (sentiment IN ('hot', 'warm', 'cold')),
    risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
    recommended_action TEXT,
    reasoning JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS para lead_insights
ALTER TABLE public.lead_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspaces can view their own insights"
    ON public.lead_insights FOR SELECT
    USING (workspace_id = (SELECT auth.uid()::uuid)); -- Assumindo política simplificada para o MVP. Na real, deve checar a tabela workspace_users.

-- Vamos usar a mesma política dos leads para ser seguro:
DROP POLICY IF EXISTS "Workspaces can view their own insights" ON public.lead_insights;
CREATE POLICY "Users can view insights from their workspaces"
    ON public.lead_insights FOR SELECT
    USING (
      workspace_id IN (
        SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid()
      )
    );

-- 2. Trigger para gerar job de insight automaticamente
-- Sempre que uma NOVA ATIVIDADE for criada, agendamos uma reavaliação do insight
CREATE OR REPLACE FUNCTION public.queue_insight_generation()
RETURNS TRIGGER AS $$
BEGIN
  -- Insere um job na fila usando UPSERT baseado no lead_id como idempotency para não enfileirar múltiplos seguidos antes de processar
  INSERT INTO public.job_queue (type, payload, idempotency_key, status)
  VALUES (
    'generate_insight',
    jsonb_build_object('lead_id', NEW.lead_id, 'workspace_id', NEW.workspace_id),
    'insight_' || NEW.lead_id, -- Chave de idempotência baseada no lead (se já tiver um pendente, não cria outro igual)
    'pending'
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET 
    status = 'pending', 
    updated_at = now()
  WHERE EXCLUDED.status IN ('completed', 'failed'); -- Só re-engatilha se o anterior já terminou

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_queue_insight_generation
AFTER INSERT ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.queue_insight_generation();
