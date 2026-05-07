-- Migration: Restore essential RPCs used by the frontend
-- Timestamp: 2026-05-06182000
--
-- Ensures these RPCs exist for fresh databases and legacy environments:
-- - get_user_workspaces(): list workspaces the current user belongs to
-- - is_workspace_admin(p_workspace_id): check if current user is owner/admin in that workspace

CREATE OR REPLACE FUNCTION public.get_user_workspaces()
RETURNS SETOF public.workspaces
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.*
  FROM public.workspaces w
  JOIN public.workspace_users wu ON wu.workspace_id = w.id
  WHERE wu.user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_workspaces() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_user_workspaces() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_workspaces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_workspaces() TO service_role;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_users
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_workspace_admin(UUID) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID) TO service_role;

