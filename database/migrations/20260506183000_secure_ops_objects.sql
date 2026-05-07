-- Migration: Secure ops-only objects (views/RPCs/internal tables)
-- Timestamp: 2026-05-06183000
--
-- Hardening:
-- - Restrict `projection_checkpoints` to backend/service_role only (RLS closed)
-- - Force `security_invoker` for ops views to avoid privilege escalation
-- - Revoke public access to ops views
-- - Lock down `get_system_health_snapshot()` (SECURITY DEFINER) to service_role only

-- 1) Internal checkpoint table should never be readable/writable by app users.
ALTER TABLE IF EXISTS public.projection_checkpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Restrict all access to projection_checkpoints" ON public.projection_checkpoints;
CREATE POLICY "Restrict all access to projection_checkpoints"
ON public.projection_checkpoints
FOR ALL
USING (false)
WITH CHECK (false);

-- 2) Views: ensure they run with invoker privileges (prevents bypassing RLS).
ALTER VIEW IF EXISTS public.v_system_health SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_workspace_performance SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_dlq_analysis SET (security_invoker = on);

-- 3) Revoke access from app roles (views are ops-only).
REVOKE ALL ON public.v_system_health FROM anon, authenticated;
REVOKE ALL ON public.v_workspace_performance FROM anon, authenticated;
REVOKE ALL ON public.v_dlq_analysis FROM anon, authenticated;

GRANT SELECT ON public.v_system_health TO service_role;
GRANT SELECT ON public.v_workspace_performance TO service_role;
GRANT SELECT ON public.v_dlq_analysis TO service_role;

-- 4) RPC: system health snapshot is ops-only. Default is EXECUTE to PUBLIC; revoke explicitly.
REVOKE EXECUTE ON FUNCTION public.get_system_health_snapshot() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_system_health_snapshot() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_system_health_snapshot() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_health_snapshot() TO service_role;

