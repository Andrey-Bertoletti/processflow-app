-- Migration: Fix stage-trigger automation for AI message generation
-- Ensures jobs are enqueued when:
-- 1) a lead is created directly in a trigger stage (AFTER INSERT)
-- 2) a lead is moved into a trigger stage (AFTER UPDATE OF stage_id)
--
-- This migration consolidates older attempts (direct enqueue trigger and domain_events routing)
-- into a single source of truth: `job_queue` + a `messages` placeholder.

-- Safety: guarantee required columns exist (older environments).
ALTER TABLE public.stages
ADD COLUMN IF NOT EXISTS auto_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_automated boolean DEFAULT false;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS status text DEFAULT 'success';

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Disable legacy automation triggers to prevent double-enqueue / duplicate placeholders.
DROP TRIGGER IF EXISTS trg_enqueue_ai_message ON public.leads;
DROP TRIGGER IF EXISTS trg_publish_lead_events ON public.leads;
DO $$
BEGIN
  IF to_regclass('public.domain_events') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_route_domain_events ON public.domain_events';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enqueue_stage_trigger_ai_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_campaign_id uuid;
  v_idempotency_key text;
  v_has_campaign_status boolean;
  v_campaign_status text;
  v_is_allowed boolean;
  v_placeholder_id uuid;
BEGIN
  -- Only run on insert or stage change.
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  IF NEW.stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve stage trigger campaign.
  SELECT auto_campaign_id
  INTO v_campaign_id
  FROM public.stages
  WHERE id = NEW.stage_id;

  IF v_campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Optional: validate campaign is active when a status column exists.
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'campaigns'
      AND column_name = 'status'
  ) INTO v_has_campaign_status;

  IF v_has_campaign_status THEN
    EXECUTE 'SELECT status FROM public.campaigns WHERE id = $1'
      INTO v_campaign_status
      USING v_campaign_id;

    IF v_campaign_status IS DISTINCT FROM 'active' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Optional: cost governor (if present).
  IF to_regprocedure('public.check_ai_cost_governor(uuid)') IS NOT NULL THEN
    v_is_allowed := public.check_ai_cost_governor(NEW.workspace_id);
    IF NOT v_is_allowed THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Idempotency key prevents duplicate pending jobs for the same lead/campaign.
  v_idempotency_key := 'ai_msg_' || NEW.id::text || '_' || v_campaign_id::text;

  -- If a pending/processing job already exists for this lead+campaign (from older idempotency keys),
  -- do not enqueue a second one.
  IF NOT EXISTS (
    SELECT 1
    FROM public.job_queue jq
    WHERE jq.type = 'generate_ai_message'
      AND jq.status IN ('pending', 'processing')
      AND jq.payload->>'lead_id' = NEW.id::text
      AND jq.payload->>'campaign_id' = v_campaign_id::text
  ) THEN
    INSERT INTO public.job_queue (type, payload, idempotency_key)
    VALUES (
      'generate_ai_message',
      jsonb_build_object(
        'lead_id', NEW.id,
        'workspace_id', NEW.workspace_id,
        'campaign_id', v_campaign_id,
        'stage_id', NEW.stage_id,
        'source', 'trigger_stage'
      ),
      v_idempotency_key
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  -- Create or update a placeholder message for UI feedback.
  SELECT id
  INTO v_placeholder_id
  FROM public.messages
  WHERE workspace_id = NEW.workspace_id
    AND lead_id = NEW.id
    AND campaign_id = v_campaign_id
    AND is_automated = true
    AND status = 'pending'
    AND COALESCE(metadata->>'origin', '') = 'trigger_stage'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_placeholder_id IS NULL THEN
    INSERT INTO public.messages (
      workspace_id,
      lead_id,
      campaign_id,
      content,
      is_automated,
      status,
      metadata
    ) VALUES (
      NEW.workspace_id,
      NEW.id,
      v_campaign_id,
      'A IA está redigindo uma mensagem...',
      true,
      'pending',
      jsonb_build_object(
        'origin', 'trigger_stage',
        'stage_id', NEW.stage_id,
        'idempotency_key', v_idempotency_key
      )
    );
  ELSE
    UPDATE public.messages
    SET content = 'A IA está redigindo uma mensagem...',
        updated_at = now(),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'origin', 'trigger_stage',
          'stage_id', NEW.stage_id,
          'idempotency_key', v_idempotency_key
        )
    WHERE id = v_placeholder_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_stage_trigger_ai_message ON public.leads;
CREATE TRIGGER trg_enqueue_stage_trigger_ai_message
AFTER INSERT OR UPDATE OF stage_id ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_stage_trigger_ai_message();
