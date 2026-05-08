-- ==========================================
-- 1. JOB OWNERSHIP LIFETIME SAFETY (LEASES)
-- ==========================================
ALTER TABLE public.job_queue
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS locked_by UUID, -- ID do Worker (ou Trace ID)
ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMP WITH TIME ZONE;

-- Atualizamos a Procedure de Lock Atômico para respeitar a "Locação" (Lease)
-- Se o Job estiver "processing" mas o lock expirou (ex: Worker crashou), o Job é resgatado
CREATE OR REPLACE FUNCTION public.acquire_ai_job(p_job_id UUID, p_trace_id UUID, p_lease_minutes INT DEFAULT 5)
RETURNS TABLE (
  id UUID, 
  payload JSONB, 
  attempts INT, 
  max_attempts INT, 
  priority INT,
  trace_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.job_queue
  SET status = 'processing',
      attempts = public.job_queue.attempts + 1,
      updated_at = now(),
      locked_at = now(),
      locked_by = p_trace_id,
      lock_expires_at = now() + (p_lease_minutes || ' minutes')::INTERVAL,
      trace_id = p_trace_id
  WHERE public.job_queue.id = (
    SELECT jq.id
    FROM public.job_queue jq
    WHERE jq.id = p_job_id 
      AND (
        (jq.status = 'pending' AND jq.next_retry_at <= now())
        OR 
        -- HEARTBEAT TIMEOUT (Se estourou o tempo, outro worker pode roubar)
        (jq.status = 'processing' AND jq.lock_expires_at < now())
      )
    FOR UPDATE SKIP LOCKED
  )
  RETURNING 
    public.job_queue.id, 
    public.job_queue.payload, 
    public.job_queue.attempts, 
    public.job_queue.max_attempts, 
    public.job_queue.priority,
    public.job_queue.trace_id;
END;
$$;

-- ==========================================
-- 2. RECONCILIATION PROCESS (JOB REPAIR SCANNER)
-- ==========================================
-- Essa função varre o banco buscando Zumbis. 
-- Pode ser rodada via pg_cron ou via Edge Function CRON.
CREATE OR REPLACE FUNCTION public.reconcile_stuck_jobs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_repaired_count INT;
BEGIN
  WITH stuck_jobs AS (
    UPDATE public.job_queue
    SET status = 'pending',
        error_log = 'Reconciled by Scanner: Worker died without releasing lock',
        updated_at = now(),
        locked_at = NULL,
        locked_by = NULL,
        lock_expires_at = NULL
    WHERE status = 'processing' AND lock_expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO v_repaired_count FROM stuck_jobs;
  
  RETURN v_repaired_count;
END;
$$;

-- ==========================================
-- 3. COST GOVERNOR (OPENAI SHIELD / LIMITES)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.workspace_ai_quotas (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  daily_job_limit INT DEFAULT 100, -- Limite de gerações por dia
  monthly_job_limit INT DEFAULT 2000,
  is_suspended BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.workspace_ai_quotas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workspace_ai_usage (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date_key DATE NOT NULL DEFAULT CURRENT_DATE,
  jobs_processed INT DEFAULT 0,
  tokens_consumed INT DEFAULT 0,
  PRIMARY KEY (workspace_id, date_key)
);

ALTER TABLE public.workspace_ai_usage ENABLE ROW LEVEL SECURITY;

-- Procedure para incremento atômico de uso (usada no sucesso do Job)
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_workspace_id UUID, p_tokens INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.workspace_ai_usage (workspace_id, date_key, jobs_processed, tokens_consumed)
  VALUES (p_workspace_id, CURRENT_DATE, 1, p_tokens)
  ON CONFLICT (workspace_id, date_key) 
  DO UPDATE SET 
    jobs_processed = public.workspace_ai_usage.jobs_processed + 1,
    tokens_consumed = public.workspace_ai_usage.tokens_consumed + p_tokens;
END;
$$;

-- Proteção Nível Banco: O Gatilho RECUSA enfileirar o job se estourar a cota diária
CREATE OR REPLACE FUNCTION public.check_ai_cost_governor(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quota RECORD;
  v_usage RECORD;
BEGIN
  -- Cria a cota se não existir (lazy init)
  INSERT INTO public.workspace_ai_quotas (workspace_id) 
  VALUES (p_workspace_id) ON CONFLICT DO NOTHING;
  
  SELECT * INTO v_quota FROM public.workspace_ai_quotas WHERE workspace_id = p_workspace_id;
  
  IF v_quota.is_suspended THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_usage FROM public.workspace_ai_usage 
  WHERE workspace_id = p_workspace_id AND date_key = CURRENT_DATE;

  IF FOUND THEN
    IF v_usage.jobs_processed >= v_quota.daily_job_limit THEN
      RETURN FALSE; -- Bloqueio Absoluto (Shield)
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

-- Atualizamos o Gatilho Original para inserir o Cost Governor
CREATE OR REPLACE FUNCTION public.enqueue_ai_message_job()
RETURNS TRIGGER AS $$
DECLARE
  v_campaign_id UUID;
  v_idempotency_key TEXT;
  v_is_allowed BOOLEAN;
BEGIN
  IF NEW.stage_id = OLD.stage_id THEN RETURN NEW; END IF;

  SELECT auto_campaign_id INTO v_campaign_id FROM public.stages WHERE id = NEW.stage_id;
  IF v_campaign_id IS NULL THEN RETURN NEW; END IF;

  -- Verifica o Cost Governor
  v_is_allowed := public.check_ai_cost_governor(NEW.workspace_id);
  IF NOT v_is_allowed THEN
    RAISE LOG 'COST GOVERNOR BLOCK: Workspace % excedeu limites de uso da IA.', NEW.workspace_id;
    RETURN NEW; -- Ignora silenciosamente, evitando estourar API de erros
  END IF;

  v_idempotency_key := 'ai_msg_' || NEW.id::TEXT || '_' || NEW.stage_id::TEXT || '_' || v_campaign_id::TEXT;

  INSERT INTO public.job_queue (type, payload, idempotency_key) 
  VALUES (
    'generate_ai_message',
    jsonb_build_object('lead_id', NEW.id, 'workspace_id', NEW.workspace_id, 'campaign_id', v_campaign_id, 'stage_id', NEW.stage_id),
    v_idempotency_key
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO public.messages (workspace_id, lead_id, campaign_id, content, is_automated, status) 
  VALUES (NEW.workspace_id, NEW.id, v_campaign_id, 'A IA está redigindo uma mensagem... 🤖', true, 'pending');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
