-- Migration: Add joined_at to get_workspace_members RPC
-- Timestamp: 20260507170000

DROP FUNCTION IF EXISTS public.get_workspace_members(uuid);

CREATE OR REPLACE FUNCTION public.get_workspace_members(p_workspace_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role text,
  email text,
  display_name text,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wu.id,
    wu.user_id,
    wu.role,
    u.email,
    coalesce(nullif(trim(u.email), ''), wu.user_id::text) as display_name,
    wu.created_at as joined_at
  FROM public.workspace_users wu
  LEFT JOIN auth.users u ON u.id = wu.user_id
  WHERE wu.workspace_id = p_workspace_id
    AND public.is_user_in_workspace(p_workspace_id)
  ORDER BY wu.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_workspace_members(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_workspace_members(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_members(uuid) TO service_role;
