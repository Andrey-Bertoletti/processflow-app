-- Migration: Fix Automation Trigger (INSERT + UPDATE)
-- Timestamp: 2026-05-06020000

CREATE OR REPLACE FUNCTION public.fn_enqueue_ai_message()
RETURNS TRIGGER AS $$
DECLARE
    v_auto_campaign_id UUID;
    v_workspace_id UUID;
BEGIN
    SELECT auto_campaign_id, workspace_id INTO v_auto_campaign_id, v_workspace_id
    FROM public.stages
    WHERE id = NEW.stage_id;

    IF v_auto_campaign_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.job_queue 
            WHERE lead_id = NEW.id 
            AND type = 'generate_message' 
            AND status = 'pending'
        ) THEN
            INSERT INTO public.job_queue (workspace_id, lead_id, type, payload)
            VALUES (v_workspace_id, NEW.id, 'generate_message', jsonb_build_object(
                'campaign_id', v_auto_campaign_id,
                'force_regenerate', false
            ));
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enqueue_ai_message ON public.leads;
CREATE TRIGGER trg_enqueue_ai_message
    AFTER INSERT OR UPDATE OF stage_id ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enqueue_ai_message();
