-- ==========================================
-- 1. EVENT BUS ABSTRACTION (DOMAIN EVENTS)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL, -- ex: 'lead'
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- ex: 'lead_stage_changed'
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Impede qualquer UPDATE ou DELETE (Immutable Log)
CREATE RULE no_update_domain_events AS ON UPDATE TO public.domain_events DO INSTEAD NOTHING;
CREATE RULE no_delete_domain_events AS ON DELETE TO public.domain_events DO INSTEAD NOTHING;

ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 2. IMMUTABLE JOB EXECUTION LOG (EVENT SOURCING)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.job_queue(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'job_created', 'job_claimed', 'job_failed', 'job_retried', 'job_completed'
  trace_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE RULE no_update_job_events AS ON UPDATE TO public.job_events DO INSTEAD NOTHING;
CREATE RULE no_delete_job_events AS ON DELETE TO public.job_events DO INSTEAD NOTHING;

ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para gravar no log imutável a cada mudança da fila
CREATE OR REPLACE FUNCTION public.log_job_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.job_events (job_id, event_type, details) 
    VALUES (NEW.id, 'job_created', jsonb_build_object('payload', NEW.payload));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'pending' AND NEW.status = 'processing' THEN
      INSERT INTO public.job_events (job_id, event_type, trace_id, details) 
      VALUES (NEW.id, 'job_claimed', NEW.trace_id, jsonb_build_object('worker_id', NEW.locked_by));
    ELSIF OLD.status = 'processing' AND NEW.status = 'completed' THEN
      INSERT INTO public.job_events (job_id, event_type, trace_id) 
      VALUES (NEW.id, 'job_completed', NEW.trace_id);
    ELSIF OLD.status = 'processing' AND NEW.status = 'pending' THEN
      INSERT INTO public.job_events (job_id, event_type, trace_id, details) 
      VALUES (NEW.id, 'job_retried', NEW.trace_id, jsonb_build_object('reason', NEW.error_log, 'next_retry_at', NEW.next_retry_at));
    ELSIF OLD.status = 'processing' AND NEW.status = 'failed' THEN
      INSERT INTO public.job_events (job_id, event_type, trace_id, details) 
      VALUES (NEW.id, 'job_failed', NEW.trace_id, jsonb_build_object('error', NEW.error_log));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_job_queue
AFTER INSERT OR UPDATE ON public.job_queue
FOR EACH ROW EXECUTE FUNCTION public.log_job_event();

-- ==========================================
-- 3. GLOBAL CONCURRENCY LIMITER (BACKPRESSURE)
-- ==========================================
-- Refatorando o acquire_ai_job para respeitar um limite global de concorrência
CREATE OR REPLACE FUNCTION public.acquire_ai_job(p_job_id UUID, p_trace_id UUID, p_lease_minutes INT DEFAULT 5)
RETURNS TABLE (
  id UUID, payload JSONB, attempts INT, max_attempts INT, priority INT, trace_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_global_processing INT;
  v_global_limit INT := 50; -- Limite global estrito (Proteção OpenAI e Infra)
BEGIN
  -- 1. Verifica Backpressure Global
  SELECT count(*) INTO v_global_processing 
  FROM public.job_queue 
  WHERE status = 'processing' AND lock_expires_at > now();

  IF v_global_processing >= v_global_limit THEN
    -- Backpressure ativado: Recusa a entrega do job agora
    RETURN;
  END IF;

  -- 2. Tenta fazer o Lease Atômico
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
        (jq.status = 'processing' AND jq.lock_expires_at < now())
      )
    FOR UPDATE SKIP LOCKED
  )
  RETURNING 
    public.job_queue.id, public.job_queue.payload, public.job_queue.attempts, 
    public.job_queue.max_attempts, public.job_queue.priority, public.job_queue.trace_id;
END;
$$;

-- ==========================================
-- 4. DESACOPLANDO O DOMÍNIO DA FILA
-- ==========================================
-- A) Trigger 1: Domínio -> Publica no Event Bus
CREATE OR REPLACE FUNCTION public.publish_lead_stage_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage_id = OLD.stage_id THEN RETURN NEW; END IF;

  INSERT INTO public.domain_events (aggregate_type, aggregate_id, event_type, payload)
  VALUES (
    'lead', NEW.id, 'lead_stage_changed',
    jsonb_build_object(
      'workspace_id', NEW.workspace_id,
      'old_stage_id', OLD.stage_id,
      'new_stage_id', NEW.stage_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove o antigo enqueue engessado direto de leads
DROP TRIGGER IF EXISTS trg_enqueue_ai_message ON public.leads;

CREATE TRIGGER trg_publish_lead_events
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.publish_lead_stage_changed();

-- B) Trigger 2: Event Bus -> Roteia para Fila de Trabalhos (Choreography Pattern)
CREATE OR REPLACE FUNCTION public.route_domain_events()
RETURNS TRIGGER AS $$
DECLARE
  v_campaign_id UUID;
  v_is_allowed BOOLEAN;
  v_lead_id UUID;
  v_stage_id UUID;
  v_workspace_id UUID;
BEGIN
  -- Escuta especificamente o evento de troca de pipeline
  IF NEW.event_type = 'lead_stage_changed' THEN
    v_lead_id := (NEW.payload->>'lead_id')::UUID; -- na verdade é o aggregate_id
    v_stage_id := (NEW.payload->>'new_stage_id')::UUID;
    v_workspace_id := (NEW.payload->>'workspace_id')::UUID;

    -- Usa aggregate_id que é garantido
    v_lead_id := NEW.aggregate_id;

    -- Regra de negócio: Tem automação?
    SELECT auto_campaign_id INTO v_campaign_id FROM public.stages WHERE id = v_stage_id;
    IF v_campaign_id IS NOT NULL THEN
      
      -- Governor Cost Check
      v_is_allowed := public.check_ai_cost_governor(v_workspace_id);
      IF v_is_allowed THEN
        INSERT INTO public.job_queue (type, payload, idempotency_key) 
        VALUES (
          'generate_ai_message',
          jsonb_build_object('lead_id', v_lead_id, 'workspace_id', v_workspace_id, 'campaign_id', v_campaign_id, 'stage_id', v_stage_id),
          'ai_msg_' || v_lead_id::TEXT || '_' || v_stage_id::TEXT || '_' || v_campaign_id::TEXT
        ) ON CONFLICT (idempotency_key) DO NOTHING;

        -- Feedback UI Visual
        INSERT INTO public.messages (workspace_id, lead_id, campaign_id, content, is_automated, status) 
        VALUES (v_workspace_id, v_lead_id, v_campaign_id, 'A IA está redigindo uma mensagem... 🤖', true, 'pending');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_route_domain_events
  AFTER INSERT ON public.domain_events
  FOR EACH ROW EXECUTE FUNCTION public.route_domain_events();
