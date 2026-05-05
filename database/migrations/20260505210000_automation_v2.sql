-- 1. Status na tabela messages para gerenciar filas (pending, success, error)
ALTER TABLE public.messages ADD COLUMN status TEXT DEFAULT 'success';

-- Atualiza as atuais para success para não quebrar compatibilidade
UPDATE public.messages SET status = 'success' WHERE status IS NULL;

-- 2. Tabela de logs e idempotência de automação
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'pending', 'success', 'error'
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índice único para garantir idempotência severa no banco (mesmo lead para a mesma campanha na mesma etapa só gera uma automação com sucesso)
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_idempotency 
ON public.automation_logs (lead_id, campaign_id, stage_id) 
WHERE status IN ('success', 'pending');

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation logs from their workspace"
  ON public.automation_logs
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid()
    )
  );
