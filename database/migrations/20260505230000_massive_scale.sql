-- 1. Job Priority System & Observability
ALTER TABLE public.job_queue
ADD COLUMN IF NOT EXISTS priority INT DEFAULT 0, -- 0=Low, 1=Medium, 2=High
ADD COLUMN IF NOT EXISTS trace_id UUID DEFAULT gen_random_uuid(); -- Para rastrear os logs

-- 2. Dead Letter Queue (DLQ)
CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_job_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_log TEXT,
  failed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- 3. Concurrency Control Sênior: RPC com FOR UPDATE SKIP LOCKED
-- Protege completamente contra Race Conditions sob extrema carga
CREATE OR REPLACE FUNCTION public.acquire_ai_job(p_job_id UUID)
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
      updated_at = now()
  WHERE public.job_queue.id = (
    SELECT jq.id
    FROM public.job_queue jq
    WHERE jq.id = p_job_id 
      AND jq.status = 'pending'
      -- Rate Limit Básico de Segurança: Se tentar rodar antes do backoff, ignora (evita retry flood)
      AND jq.next_retry_at <= now()
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

-- 4. Função auxiliar para falhas críticas (DLQ router)
CREATE OR REPLACE FUNCTION public.route_to_dlq(p_job_id UUID, p_error TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT * INTO v_job FROM public.job_queue WHERE id = p_job_id;
  
  IF FOUND THEN
    INSERT INTO public.dead_letter_queue (
      original_job_id, workspace_id, type, payload, error_log
    ) VALUES (
      v_job.id, 
      (v_job.payload->>'workspace_id')::UUID, 
      v_job.type, 
      v_job.payload, 
      p_error
    );

    UPDATE public.job_queue 
    SET status = 'failed', updated_at = now(), error_log = p_error 
    WHERE id = p_job_id;
  END IF;
END;
$$;
