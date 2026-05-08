-- Migration: Enhanced Dashboard Metrics
-- Objective: Provide data for messages per campaign, 30-day growth, and conversion rates.

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_total_leads INT;
  v_total_campaigns INT;
  v_leads_30d INT;
  v_stage_distribution JSONB;
  v_intelligence_distribution JSONB;
  v_messages_per_campaign JSONB;
  v_conversion_rate NUMERIC;
  v_last_stage_id UUID;
BEGIN
  -- 1. Total leads
  SELECT COUNT(*) INTO v_total_leads FROM public.leads WHERE workspace_id = p_workspace_id;
  
  -- 2. Total active campaigns (ajustado para lidar com is_active se existir, senão conta todas)
  SELECT COUNT(*) INTO v_total_campaigns FROM public.campaigns WHERE workspace_id = p_workspace_id;
  
  -- 3. Leads nos últimos 30 dias
  SELECT COUNT(*) INTO v_leads_30d 
  FROM public.leads 
  WHERE workspace_id = p_workspace_id 
    AND created_at >= NOW() - INTERVAL '30 days';
  
  -- 4. Distribuição por etapas
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
  
  -- 5. Distribuição de Inteligência (Hot/Warm/Cold)
  SELECT jsonb_build_object(
    'hot', COALESCE(SUM(CASE WHEN sentiment = 'hot' THEN 1 ELSE 0 END), 0),
    'warm', COALESCE(SUM(CASE WHEN sentiment = 'warm' THEN 1 ELSE 0 END), 0),
    'cold', COALESCE(SUM(CASE WHEN sentiment = 'cold' THEN 1 ELSE 0 END), 0)
  ) INTO v_intelligence_distribution
  FROM public.lead_insights
  WHERE workspace_id = p_workspace_id;

  -- 6. Mensagens geradas por campanha
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

  -- 7. Taxa de Conversão (Leads na última etapa / Total)
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
    'stage_distribution', COALESCE(v_stage_distribution, '[]'::jsonb),
    'intelligence_distribution', COALESCE(v_intelligence_distribution, '{"hot":0,"warm":0,"cold":0}'::jsonb),
    'messages_per_campaign', COALESCE(v_messages_per_campaign, '[]'::jsonb),
    'conversion_rate', ROUND(v_conversion_rate, 2)
  );
END;
$function$;
