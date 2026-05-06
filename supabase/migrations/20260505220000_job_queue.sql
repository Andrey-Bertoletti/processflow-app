-- 1. Tabela de Fila de Trabalhos (Job Queue Real)
CREATE TABLE IF NOT EXISTS public.job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- ex: 'generate_ai_message'
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  error_log TEXT,
  idempotency_key TEXT UNIQUE, -- Chave bruta por evento
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
-- Apenas service_role pode operar na fila por padrão, RLS fechado para usuários

-- 2. Gatilho (Database Trigger) direto no Banco para enfileirar o Job
-- Remove a necessidade do webhook bater na Edge Function só para enfileirar
CREATE OR REPLACE FUNCTION public.enqueue_ai_message_job()
RETURNS TRIGGER AS $$
DECLARE
  v_campaign_id UUID;
  v_idempotency_key TEXT;
BEGIN
  -- Se stage não mudou, ignora
  IF NEW.stage_id = OLD.stage_id THEN
    RETURN NEW;
  END IF;

  -- Verifica se o novo stage tem auto_campaign
  SELECT auto_campaign_id INTO v_campaign_id
  FROM public.stages
  WHERE id = NEW.stage_id;

  IF v_campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Chave de idempotência forte: lead + stage + campaign
  v_idempotency_key := 'ai_msg_' || NEW.id::TEXT || '_' || NEW.stage_id::TEXT || '_' || v_campaign_id::TEXT;

  -- Tenta inserir na fila. Se a idempotency_key já existir, ele simplesmente ignora (ON CONFLICT DO NOTHING)
  INSERT INTO public.job_queue (
    type, 
    payload, 
    idempotency_key
  ) VALUES (
    'generate_ai_message',
    jsonb_build_object(
      'lead_id', NEW.id,
      'workspace_id', NEW.workspace_id,
      'campaign_id', v_campaign_id,
      'stage_id', NEW.stage_id
    ),
    v_idempotency_key
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  -- Aproveitamos o trigger para já criar a interface visual de "pending" no Front
  -- Inserimos a mensagem na UI com status 'pending' de forma atômica
  INSERT INTO public.messages (
    workspace_id, lead_id, campaign_id, content, is_automated, status
  ) VALUES (
    NEW.workspace_id, NEW.id, v_campaign_id, 'A IA está redigindo uma mensagem... 🤖', true, 'pending'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o trigger na tabela leads
DROP TRIGGER IF EXISTS trg_enqueue_ai_message ON public.leads;
CREATE TRIGGER trg_enqueue_ai_message
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_ai_message_job();
