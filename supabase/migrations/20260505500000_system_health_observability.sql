-- ============================================================
-- PHASE 11: PRODUCTION HARDENING
-- Migration: 20260505500000_system_health_observability.sql
-- ============================================================
-- Creates a real-time system health layer:
--   - v_system_health: live metrics view for the ops dashboard
--   - v_worker_performance: per-job latency and cost tracking
--   - v_dlq_analysis: dead letter queue analysis
--   - get_system_health_snapshot(): callable RPC from frontend
-- ============================================================

-- ─── 1. SYSTEM HEALTH VIEW (LIVE OPS DASHBOARD) ─────────────────────────────

CREATE OR REPLACE VIEW public.v_system_health AS
WITH job_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending')                              AS jobs_pending,
    COUNT(*) FILTER (WHERE status = 'processing')                           AS jobs_processing,
    COUNT(*) FILTER (WHERE status = 'completed')                            AS jobs_completed,
    COUNT(*) FILTER (WHERE status = 'failed')                               AS jobs_failed,
    COUNT(*) FILTER (WHERE status = 'processing' AND lock_expires_at < now()) AS jobs_zombie,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000)
      FILTER (WHERE status = 'completed')                                   AS avg_job_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000
    ) FILTER (WHERE status = 'completed')                                   AS p95_job_latency_ms,
    COUNT(*) FILTER (WHERE status = 'completed' AND updated_at > now() - INTERVAL '1 hour') AS completed_last_1h,
    COUNT(*) FILTER (WHERE status = 'failed' AND updated_at > now() - INTERVAL '1 hour')    AS failed_last_1h
  FROM public.job_queue
  WHERE created_at > now() - INTERVAL '24 hours'
),
dlq_stats AS (
  SELECT
    COUNT(*)                                                                AS dlq_total,
    COUNT(*) FILTER (WHERE failed_at > now() - INTERVAL '1 hour')          AS dlq_last_1h,
    COUNT(*) FILTER (WHERE failed_at > now() - INTERVAL '24 hours')        AS dlq_last_24h
  FROM public.dead_letter_queue
),
ai_cost_stats AS (
  SELECT
    SUM(tokens_consumed)                                                    AS total_tokens_today,
    SUM(jobs_processed)                                                     AS total_ai_jobs_today,
    COUNT(DISTINCT workspace_id)                                            AS active_workspaces_today,
    -- Cost estimate: gpt-4o-mini ~$0.00015/1k input + $0.0006/1k output — rough average $0.0003/1k
    ROUND((SUM(tokens_consumed)::NUMERIC / 1000) * 0.0003, 4)              AS estimated_cost_usd
  FROM public.workspace_ai_usage
  WHERE date_key = CURRENT_DATE
),
throughput_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'completed' AND updated_at > now() - INTERVAL '5 minutes') AS jobs_last_5m,
    COUNT(*) FILTER (WHERE status = 'completed' AND updated_at > now() - INTERVAL '15 minutes') AS jobs_last_15m,
    COUNT(*) FILTER (WHERE status = 'completed' AND updated_at > now() - INTERVAL '60 minutes') AS jobs_last_60m
  FROM public.job_queue
),
retry_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE attempts > 1)                                    AS retried_jobs,
    COUNT(*)                                                                AS total_jobs,
    ROUND(
      COUNT(*) FILTER (WHERE attempts > 1)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2
    )                                                                       AS retry_rate_pct
  FROM public.job_queue
  WHERE created_at > now() - INTERVAL '24 hours'
)
SELECT
  -- Job Queue Health
  j.jobs_pending,
  j.jobs_processing,
  j.jobs_completed,
  j.jobs_failed,
  j.jobs_zombie,
  ROUND(j.avg_job_latency_ms::NUMERIC, 0)                                  AS avg_job_latency_ms,
  ROUND(j.p95_job_latency_ms::NUMERIC, 0)                                  AS p95_job_latency_ms,
  j.completed_last_1h,
  j.failed_last_1h,
  -- Derived: success rate last 1h
  ROUND(
    j.completed_last_1h::NUMERIC / NULLIF(j.completed_last_1h + j.failed_last_1h, 0) * 100, 2
  )                                                                         AS success_rate_1h_pct,
  -- DLQ
  d.dlq_total,
  d.dlq_last_1h,
  d.dlq_last_24h,
  -- AI Cost
  c.total_tokens_today,
  c.total_ai_jobs_today,
  c.active_workspaces_today,
  c.estimated_cost_usd,
  -- Throughput (jobs/min)
  ROUND(t.jobs_last_5m::NUMERIC / 5, 2)                                    AS throughput_jobs_per_min,
  t.jobs_last_5m,
  t.jobs_last_15m,
  t.jobs_last_60m,
  -- Retry
  r.retried_jobs,
  r.retry_rate_pct,
  -- Snapshot timestamp
  now()                                                                     AS snapshot_at
FROM job_stats j
CROSS JOIN dlq_stats d
CROSS JOIN ai_cost_stats c
CROSS JOIN throughput_stats t
CROSS JOIN retry_stats r;

-- ─── 2. PER-WORKSPACE PERFORMANCE VIEW ──────────────────────────────────────

CREATE OR REPLACE VIEW public.v_workspace_performance AS
SELECT
  u.workspace_id,
  w.name AS workspace_name,
  u.date_key,
  u.jobs_processed,
  u.tokens_consumed,
  -- Cost estimate per workspace
  ROUND((u.tokens_consumed::NUMERIC / 1000) * 0.0003, 4)                  AS estimated_cost_usd,
  q.daily_job_limit,
  ROUND(u.jobs_processed::NUMERIC / NULLIF(q.daily_job_limit, 0) * 100, 1) AS quota_usage_pct,
  q.is_suspended,
  -- Retry rate per workspace
  (
    SELECT ROUND(
      COUNT(*) FILTER (WHERE jq.attempts > 1)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2
    )
    FROM public.job_queue jq
    WHERE (jq.payload->>'workspace_id')::UUID = u.workspace_id
      AND jq.created_at::DATE = u.date_key
  )                                                                         AS retry_rate_pct,
  -- Failure rate per workspace
  (
    SELECT ROUND(
      COUNT(*) FILTER (WHERE jq.status = 'failed')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2
    )
    FROM public.job_queue jq
    WHERE (jq.payload->>'workspace_id')::UUID = u.workspace_id
      AND jq.created_at::DATE = u.date_key
  )                                                                         AS failure_rate_pct
FROM public.workspace_ai_usage u
JOIN public.workspaces w ON w.id = u.workspace_id
LEFT JOIN public.workspace_ai_quotas q ON q.workspace_id = u.workspace_id
ORDER BY u.date_key DESC, u.jobs_processed DESC;

-- ─── 3. DLQ ANALYSIS VIEW ────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_dlq_analysis AS
SELECT
  d.id,
  d.workspace_id,
  w.name AS workspace_name,
  d.type AS job_type,
  d.payload,
  d.error_log,
  -- Classify error type
  CASE
    WHEN d.error_log ILIKE '%rate limit%' OR d.error_log ILIKE '%429%' THEN 'openai_rate_limit'
    WHEN d.error_log ILIKE '%timeout%' OR d.error_log ILIKE '%timed out%' THEN 'timeout'
    WHEN d.error_log ILIKE '%not found%' OR d.error_log ILIKE '%fantasma%' THEN 'orphan_reference'
    WHEN d.error_log ILIKE '%reconcil%' THEN 'zombie_recovered'
    WHEN d.error_log ILIKE '%chaos%' THEN 'chaos_test'
    ELSE 'unknown'
  END                                                                       AS error_category,
  d.failed_at,
  -- Time since failure
  ROUND(EXTRACT(EPOCH FROM (now() - d.failed_at)) / 60)                    AS minutes_since_failure,
  -- Original job still exists?
  EXISTS (
    SELECT 1 FROM public.job_queue jq WHERE jq.id = d.original_job_id
  )                                                                         AS original_job_exists
FROM public.dead_letter_queue d
LEFT JOIN public.workspaces w ON w.id = d.workspace_id
ORDER BY d.failed_at DESC;

-- ─── 4. RPC: SYSTEM HEALTH SNAPSHOT (Called from frontend ops dashboard) ─────

CREATE OR REPLACE FUNCTION public.get_system_health_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_health RECORD;
  v_top_workspaces JSONB;
  v_dlq_breakdown JSONB;
  v_alerts JSONB := '[]'::JSONB;
  v_alert TEXT;
BEGIN
  -- Fetch main health metrics
  SELECT * INTO v_health FROM public.v_system_health;

  -- Top workspaces by usage today
  SELECT jsonb_agg(row_to_json(wp)) INTO v_top_workspaces
  FROM (
    SELECT workspace_name, jobs_processed, estimated_cost_usd, quota_usage_pct, is_suspended
    FROM public.v_workspace_performance
    WHERE date_key = CURRENT_DATE
    ORDER BY jobs_processed DESC
    LIMIT 10
  ) wp;

  -- DLQ breakdown by error category
  SELECT jsonb_object_agg(error_category, cnt) INTO v_dlq_breakdown
  FROM (
    SELECT error_category, COUNT(*) AS cnt
    FROM public.v_dlq_analysis
    WHERE failed_at > now() - INTERVAL '24 hours'
      AND error_category != 'chaos_test'
    GROUP BY error_category
  ) ec;

  -- Smart alerts generation
  IF v_health.jobs_zombie > 0 THEN
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object('level', 'warning', 'message',
        format('%s zombie jobs detected (lock expired without release). Run reconcile_stuck_jobs().', v_health.jobs_zombie))
    );
  END IF;

  IF v_health.dlq_last_1h > 5 THEN
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object('level', 'critical', 'message',
        format('%s jobs failed to DLQ in the last hour. Check OpenAI API status.', v_health.dlq_last_1h))
    );
  END IF;

  IF v_health.retry_rate_pct > 20 THEN
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object('level', 'warning', 'message',
        format('High retry rate: %s%%. OpenAI may be throttling.', v_health.retry_rate_pct))
    );
  END IF;

  IF v_health.estimated_cost_usd > 10 THEN
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object('level', 'info', 'message',
        format('Daily AI cost is $%s. Monitor spending against budget.', v_health.estimated_cost_usd))
    );
  END IF;

  IF v_health.jobs_pending > 100 THEN
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object('level', 'warning', 'message',
        format('%s jobs still pending. Worker may be stuck or overwhelmed.', v_health.jobs_pending))
    );
  END IF;

  -- System health status (green/yellow/red)
  RETURN jsonb_build_object(
    'status', CASE
      WHEN v_health.dlq_last_1h > 10 OR v_health.jobs_zombie > 10 THEN 'critical'
      WHEN v_health.dlq_last_1h > 3 OR v_health.retry_rate_pct > 20 OR v_health.jobs_zombie > 0 THEN 'degraded'
      ELSE 'healthy'
    END,
    'snapshot_at', v_health.snapshot_at,
    -- Core metrics
    'queue', jsonb_build_object(
      'pending', v_health.jobs_pending,
      'processing', v_health.jobs_processing,
      'completed', v_health.jobs_completed,
      'failed', v_health.jobs_failed,
      'zombie', v_health.jobs_zombie
    ),
    'latency', jsonb_build_object(
      'avg_ms', v_health.avg_job_latency_ms,
      'p95_ms', v_health.p95_job_latency_ms
    ),
    'throughput', jsonb_build_object(
      'jobs_per_min', v_health.throughput_jobs_per_min,
      'last_5m', v_health.jobs_last_5m,
      'last_15m', v_health.jobs_last_15m,
      'last_60m', v_health.jobs_last_60m
    ),
    'reliability', jsonb_build_object(
      'success_rate_1h_pct', v_health.success_rate_1h_pct,
      'retry_rate_pct', v_health.retry_rate_pct,
      'retried_jobs', v_health.retried_jobs
    ),
    'dlq', jsonb_build_object(
      'total', v_health.dlq_total,
      'last_1h', v_health.dlq_last_1h,
      'last_24h', v_health.dlq_last_24h,
      'breakdown', COALESCE(v_dlq_breakdown, '{}'::JSONB)
    ),
    'cost', jsonb_build_object(
      'total_tokens_today', v_health.total_tokens_today,
      'total_ai_jobs_today', v_health.total_ai_jobs_today,
      'active_workspaces', v_health.active_workspaces_today,
      'estimated_usd_today', v_health.estimated_cost_usd
    ),
    'top_workspaces', COALESCE(v_top_workspaces, '[]'::JSONB),
    'alerts', v_alerts
  );
END;
$$;

-- ─── 5. RPC: WORKSPACE HEALTH (Per-tenant view, RLS safe) ───────────────────

CREATE OR REPLACE FUNCTION public.get_workspace_health(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_jobs RECORD;
  v_usage RECORD;
  v_quota RECORD;
  v_dlq_count INT;
BEGIN
  -- Validate user has access to this workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_users
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
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

-- ─── 6. PERFORMANCE INDEX AUDIT ─────────────────────────────────────────────
-- Ensures critical query paths are covered by indexes

-- Job queue: fast pending-job pickup by worker
CREATE INDEX IF NOT EXISTS idx_job_queue_pending_retry
  ON public.job_queue (status, next_retry_at, priority DESC)
  WHERE status = 'pending';

-- Job queue: zombie detection by reconciler
CREATE INDEX IF NOT EXISTS idx_job_queue_zombie_detection
  ON public.job_queue (status, lock_expires_at)
  WHERE status = 'processing';

-- Job queue: workspace isolation for throttle check
CREATE INDEX IF NOT EXISTS idx_job_queue_workspace_status
  ON public.job_queue ((payload->>'workspace_id'), status);

-- DLQ: fast workspace scans
CREATE INDEX IF NOT EXISTS idx_dlq_workspace_failed
  ON public.dead_letter_queue (workspace_id, failed_at DESC);

-- AI usage: daily cost aggregation
CREATE INDEX IF NOT EXISTS idx_ai_usage_date
  ON public.workspace_ai_usage (date_key DESC, workspace_id);

-- Leads: workspace + stage filtering (Kanban board critical path)
CREATE INDEX IF NOT EXISTS idx_leads_workspace_stage
  ON public.leads (workspace_id, stage_id)
  WHERE deleted_at IS NULL;

-- ─── COMMENT: HOW TO USE IN FRONTEND ────────────────────────────────────────
-- System (admin) ops dashboard:
--   const { data } = await supabase.rpc('get_system_health_snapshot');
--
-- Per-tenant workspace health widget:
--   const { data } = await supabase.rpc('get_workspace_health', { p_workspace_id: workspaceId });
--
-- Raw views (admin only, via service_role):
--   SELECT * FROM v_system_health;
--   SELECT * FROM v_workspace_performance WHERE date_key = CURRENT_DATE;
--   SELECT * FROM v_dlq_analysis WHERE error_category != 'chaos_test';
