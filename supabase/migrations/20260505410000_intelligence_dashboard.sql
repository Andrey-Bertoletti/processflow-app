CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_workspace_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total_leads INT;
  v_total_campaigns INT;
  v_stage_distribution JSONB;
  v_intelligence_distribution JSONB;
BEGIN
  -- Total leads
  SELECT COUNT(*) INTO v_total_leads FROM public.leads WHERE workspace_id = p_workspace_id;
  
  -- Total active campaigns
  SELECT COUNT(*) INTO v_total_campaigns FROM public.campaigns WHERE workspace_id = p_workspace_id AND is_active = true;
  
  -- Stage distribution
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
  
  -- Intelligence distribution (Phase 10)
  SELECT jsonb_build_object(
    'hot', COALESCE(SUM(CASE WHEN sentiment = 'hot' THEN 1 ELSE 0 END), 0),
    'warm', COALESCE(SUM(CASE WHEN sentiment = 'warm' THEN 1 ELSE 0 END), 0),
    'cold', COALESCE(SUM(CASE WHEN sentiment = 'cold' THEN 1 ELSE 0 END), 0)
  ) INTO v_intelligence_distribution
  FROM public.lead_insights
  WHERE workspace_id = p_workspace_id;

  RETURN jsonb_build_object(
    'total_leads', v_total_leads,
    'total_campaigns', v_total_campaigns,
    'stage_distribution', COALESCE(v_stage_distribution, '[]'::jsonb),
    'intelligence_distribution', COALESCE(v_intelligence_distribution, '{"hot":0,"warm":0,"cold":0}'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
