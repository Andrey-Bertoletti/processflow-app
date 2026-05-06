-- Migration: Secure Unrestricted Objects
-- Timestamp: 2026-05-06030000

ALTER TABLE IF EXISTS public.projection_checkpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Restrict all access to projection_checkpoints" ON public.projection_checkpoints;
CREATE POLICY "Restrict all access to projection_checkpoints" 
ON public.projection_checkpoints FOR ALL USING (false);

ALTER VIEW IF EXISTS public.v_system_health SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_workspace_performance SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_dlq_analysis SET (security_invoker = on);

REVOKE ALL ON public.v_system_health FROM anon, authenticated;
REVOKE ALL ON public.v_workspace_performance FROM anon, authenticated;
REVOKE ALL ON public.v_dlq_analysis FROM anon, authenticated;

GRANT SELECT ON public.v_system_health TO service_role;
GRANT SELECT ON public.v_workspace_performance TO service_role;
GRANT SELECT ON public.v_dlq_analysis TO service_role;
