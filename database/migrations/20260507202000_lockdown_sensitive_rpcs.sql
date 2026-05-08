-- Migration: Lock down sensitive RPCs + set search_path
-- Timestamp: 2026-05-07 20:20:00
--
-- Goals:
-- - Eliminate "Function Search Path Mutable" warnings by explicitly setting `search_path`.
-- - Ensure sensitive SECURITY DEFINER RPCs are not executable by `anon` / `authenticated`.
-- - Harden workspace-scoped metrics RPCs against IDOR by validating membership.

-- -----------------------------------------------------------------------------
-- 1) Dashboard metrics must be workspace-scoped (no IDOR)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_leads INT;
  v_total_campaigns INT;
  v_leads_30d INT;
  v_total_messages_sent INT;
  v_stage_distribution JSONB;
  v_intelligence_distribution JSONB;
  v_messages_per_campaign JSONB;
  v_leads_over_time JSONB;
  v_conversion_rate NUMERIC;
  v_last_stage_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_user_in_workspace(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  -- 1. Total leads
  SELECT COUNT(*) INTO v_total_leads FROM public.leads WHERE workspace_id = p_workspace_id;

  -- 2. Total campaigns
  SELECT COUNT(*) INTO v_total_campaigns FROM public.campaigns WHERE workspace_id = p_workspace_id;

  -- 3. Leads nos últimos 30 dias
  SELECT COUNT(*) INTO v_leads_30d
  FROM public.leads
  WHERE workspace_id = p_workspace_id
    AND created_at >= NOW() - INTERVAL '30 days';

  -- 4. Total de mensagens enviadas
  SELECT COUNT(*) INTO v_total_messages_sent
  FROM public.messages
  WHERE workspace_id = p_workspace_id AND status = 'sent';

  -- 5. Distribuição por etapas
  SELECT jsonb_agg(
    jsonb_build_object(
      'stage_id', s.id,
      'stage_name', s.name,
      'lead_count', COALESCE(l.lead_count, 0)
    )
    ORDER BY s."order" ASC
  ) INTO v_stage_distribution
  FROM public.stages s
  LEFT JOIN (
    SELECT stage_id, COUNT(*) as lead_count
    FROM public.leads
    WHERE workspace_id = p_workspace_id
    GROUP BY stage_id
  ) l ON s.id = l.stage_id
  WHERE s.workspace_id = p_workspace_id;

  -- 6. Distribuição de Inteligência (Hot/Warm/Cold)
  SELECT jsonb_build_object(
    'hot', COALESCE(SUM(CASE WHEN sentiment = 'hot' THEN 1 ELSE 0 END), 0),
    'warm', COALESCE(SUM(CASE WHEN sentiment = 'warm' THEN 1 ELSE 0 END), 0),
    'cold', COALESCE(SUM(CASE WHEN sentiment = 'cold' THEN 1 ELSE 0 END), 0)
  ) INTO v_intelligence_distribution
  FROM public.lead_insights
  WHERE workspace_id = p_workspace_id;

  -- 7. Mensagens geradas por campanha
  SELECT jsonb_agg(
    jsonb_build_object(
      'campaign_name', c.name,
      'message_count', COALESCE(m.msg_count, 0)
    )
  ) INTO v_messages_per_campaign
  FROM public.campaigns c
  LEFT JOIN (
    SELECT campaign_id, COUNT(*) as msg_count
    FROM public.messages
    WHERE workspace_id = p_workspace_id
    GROUP BY campaign_id
  ) m ON c.id = m.campaign_id
  WHERE c.workspace_id = p_workspace_id;

  -- 8. Leads ao longo do tempo (últimos 7 dias)
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', d.day::date,
      'count', COALESCE(l.count, 0)
    )
    ORDER BY d.day ASC
  ) INTO v_leads_over_time
  FROM (
    SELECT generate_series(NOW() - INTERVAL '6 days', NOW(), INTERVAL '1 day') as day
  ) d
  LEFT JOIN (
    SELECT created_at::date as day, COUNT(*) as count
    FROM public.leads
    WHERE workspace_id = p_workspace_id
    GROUP BY created_at::date
  ) l ON d.day::date = l.day;

  -- 9. Taxa de Conversão (Leads na última etapa / Total)
  SELECT id INTO v_last_stage_id
  FROM public.stages
  WHERE workspace_id = p_workspace_id
  ORDER BY "order" DESC
  LIMIT 1;

  IF v_total_leads > 0 AND v_last_stage_id IS NOT NULL THEN
    SELECT (COUNT(*)::NUMERIC / v_total_leads::NUMERIC) * 100 INTO v_conversion_rate
    FROM public.leads
    WHERE workspace_id = p_workspace_id AND stage_id = v_last_stage_id;
  ELSE
    v_conversion_rate := 0;
  END IF;

  RETURN jsonb_build_object(
    'total_leads', v_total_leads,
    'total_campaigns', v_total_campaigns,
    'leads_30d', v_leads_30d,
    'total_messages_sent', v_total_messages_sent,
    'stage_distribution', COALESCE(v_stage_distribution, '[]'::jsonb),
    'intelligence_distribution', COALESCE(v_intelligence_distribution, '{"hot":0,"warm":0,"cold":0}'::jsonb),
    'messages_per_campaign', COALESCE(v_messages_per_campaign, '[]'::jsonb),
    'leads_over_time', COALESCE(v_leads_over_time, '[]'::jsonb),
    'conversion_rate', ROUND(v_conversion_rate, 2)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 2) Sensitive internal RPCs: service_role only
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.acquire_ai_job(uuid, uuid, integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.acquire_ai_job(uuid, uuid, integer) SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.acquire_ai_job(uuid, uuid, integer) FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.acquire_ai_job(uuid, uuid, integer) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.acquire_ai_job(uuid, uuid, integer) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.acquire_ai_job(uuid, uuid, integer) TO service_role';
  END IF;

  IF to_regprocedure('public.acquire_ai_job(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.acquire_ai_job(uuid) SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.acquire_ai_job(uuid) FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.acquire_ai_job(uuid) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.acquire_ai_job(uuid) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.acquire_ai_job(uuid) TO service_role';
  END IF;

  IF to_regprocedure('public.route_to_dlq(uuid, text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.route_to_dlq(uuid, text) SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.route_to_dlq(uuid, text) FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.route_to_dlq(uuid, text) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.route_to_dlq(uuid, text) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.route_to_dlq(uuid, text) TO service_role';
  END IF;

  IF to_regprocedure('public.reconcile_stuck_jobs()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.reconcile_stuck_jobs() SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.reconcile_stuck_jobs() FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.reconcile_stuck_jobs() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.reconcile_stuck_jobs() FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.reconcile_stuck_jobs() TO service_role';
  END IF;

  IF to_regprocedure('public.increment_ai_usage(uuid, integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.increment_ai_usage(uuid, integer) SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.increment_ai_usage(uuid, integer) FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.increment_ai_usage(uuid, integer) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.increment_ai_usage(uuid, integer) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.increment_ai_usage(uuid, integer) TO service_role';
  END IF;

  IF to_regprocedure('public.check_ai_cost_governor(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.check_ai_cost_governor(uuid) SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.check_ai_cost_governor(uuid) FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.check_ai_cost_governor(uuid) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.check_ai_cost_governor(uuid) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.check_ai_cost_governor(uuid) TO service_role';
  END IF;

  IF to_regprocedure('public.advance_projection_checkpoint(text, timestamp with time zone)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.advance_projection_checkpoint(text, timestamp with time zone) SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.advance_projection_checkpoint(text, timestamp with time zone) FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.advance_projection_checkpoint(text, timestamp with time zone) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.advance_projection_checkpoint(text, timestamp with time zone) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.advance_projection_checkpoint(text, timestamp with time zone) TO service_role';
  END IF;

  IF to_regprocedure('public.cqrs_reset_projections()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.cqrs_reset_projections() SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.cqrs_reset_projections() FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.cqrs_reset_projections() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.cqrs_reset_projections() FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.cqrs_reset_projections() TO service_role';
  END IF;

  IF to_regprocedure('public.get_system_health_snapshot()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_system_health_snapshot() SET search_path = public';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3) Trigger-only SECURITY DEFINER functions should not be directly callable
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.validate_stage_requirements()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.validate_stage_requirements() SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.validate_stage_requirements() FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.validate_stage_requirements() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.validate_stage_requirements() FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.validate_stage_requirements() TO service_role';
  END IF;

  IF to_regprocedure('public.log_lead_creation()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.log_lead_creation() SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_lead_creation() FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_lead_creation() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_lead_creation() FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.log_lead_creation() TO service_role';
  END IF;

  IF to_regprocedure('public.log_lead_stage_change()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.log_lead_stage_change() SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_lead_stage_change() FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_lead_stage_change() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_lead_stage_change() FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.log_lead_stage_change() TO service_role';
  END IF;

  IF to_regprocedure('public.log_message_creation()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.log_message_creation() SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_message_creation() FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_message_creation() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_message_creation() FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.log_message_creation() TO service_role';
  END IF;

  IF to_regprocedure('public.log_message_update()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.log_message_update() SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_message_update() FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_message_update() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_message_update() FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.log_message_update() TO service_role';
  END IF;

  IF to_regprocedure('public.queue_insight_generation()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.queue_insight_generation() SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.queue_insight_generation() FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.queue_insight_generation() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.queue_insight_generation() FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.queue_insight_generation() TO service_role';
  END IF;

  IF to_regprocedure('public.log_job_event()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.log_job_event() SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_job_event() FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_job_event() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_job_event() FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.log_job_event() TO service_role';
  END IF;

  IF to_regprocedure('public.enqueue_ai_message_job()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.enqueue_ai_message_job() SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.enqueue_ai_message_job() FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.enqueue_ai_message_job() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.enqueue_ai_message_job() FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.enqueue_ai_message_job() TO service_role';
  END IF;

  IF to_regprocedure('public.publish_lead_stage_changed()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.publish_lead_stage_changed() SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.publish_lead_stage_changed() FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.publish_lead_stage_changed() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.publish_lead_stage_changed() FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.publish_lead_stage_changed() TO service_role';
  END IF;

  IF to_regprocedure('public.route_domain_events()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.route_domain_events() SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.route_domain_events() FROM public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.route_domain_events() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.route_domain_events() FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.route_domain_events() TO service_role';
  END IF;
END $$;

