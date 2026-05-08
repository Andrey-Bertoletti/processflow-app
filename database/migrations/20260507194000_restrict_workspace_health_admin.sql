-- Migration: Restrict workspace health RPC to admins
-- Timestamp: 2026-05-07 19:40:00
--
-- Why:
-- The UI for automation/worker status is admin-only (`/admin/automation`).
-- This hardens the backend so `get_workspace_health` also requires `admin`.

CREATE OR REPLACE FUNCTION public.get_workspace_health(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jobs RECORD;
  v_usage RECORD;
  v_quota RECORD;
  v_dlq_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Only admins can access worker/automation health.
  IF NOT public.is_workspace_admin(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  -- Job stats for this workspace (last 7 days)
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending')        AS pending,
    COUNT(*) FILTER (WHERE status = 'processing')     AS processing,
    COUNT(*) FILTER (WHERE status = 'completed')      AS completed,
    COUNT(*) FILTER (WHERE status = 'failed')         AS failed,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000)
      FILTER (WHERE status = 'completed')             AS avg_latency_ms,
    COUNT(*) FILTER (WHERE attempts > 1)              AS retried
  INTO v_jobs
  FROM public.job_queue
  WHERE (payload->>'workspace_id')::UUID = p_workspace_id
    AND created_at > now() - INTERVAL '7 days';

  -- AI usage today
  SELECT * INTO v_usage FROM public.workspace_ai_usage
  WHERE workspace_id = p_workspace_id AND date_key = CURRENT_DATE;

  -- Quota info
  SELECT * INTO v_quota FROM public.workspace_ai_quotas
  WHERE workspace_id = p_workspace_id;

  -- DLQ items for this workspace
  SELECT COUNT(*) INTO v_dlq_count
  FROM public.dead_letter_queue
  WHERE workspace_id = p_workspace_id;

  RETURN jsonb_build_object(
    'workspace_id', p_workspace_id,
    'snapshot_at', now(),
    'jobs_7d', jsonb_build_object(
      'pending', COALESCE(v_jobs.pending, 0),
      'processing', COALESCE(v_jobs.processing, 0),
      'completed', COALESCE(v_jobs.completed, 0),
      'failed', COALESCE(v_jobs.failed, 0),
      'retried', COALESCE(v_jobs.retried, 0),
      'avg_latency_ms', ROUND(COALESCE(v_jobs.avg_latency_ms, 0))
    ),
    'usage_today', jsonb_build_object(
      'jobs_processed', COALESCE(v_usage.jobs_processed, 0),
      'tokens_consumed', COALESCE(v_usage.tokens_consumed, 0),
      'estimated_cost_usd', ROUND((COALESCE(v_usage.tokens_consumed, 0)::NUMERIC / 1000) * 0.0003, 4)
    ),
    'quota', jsonb_build_object(
      'daily_limit', COALESCE(v_quota.daily_job_limit, 100),
      'monthly_limit', COALESCE(v_quota.monthly_job_limit, 2000),
      'is_suspended', COALESCE(v_quota.is_suspended, false),
      'usage_pct', ROUND(
        COALESCE(v_usage.jobs_processed, 0)::NUMERIC / NULLIF(COALESCE(v_quota.daily_job_limit, 100), 0) * 100, 1
      )
    ),
    'dlq_total', v_dlq_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_workspace_health(UUID) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_workspace_health(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_health(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_health(UUID) TO service_role;

