-- Migration: Normalize workspace roles to admin/member only
-- Timestamp: 2026-05-07090000
--
-- Requirements:
-- - Only two roles exist in public.workspace_users.role: 'admin' and 'member'
-- - First user that creates a workspace becomes 'admin'
-- - New members default to 'member'
-- - Backend/RLS enforces admin-only access for admin areas/actions

-- 1) Normalize existing data
UPDATE public.workspace_users
SET role = 'admin'
WHERE role = 'owner';

UPDATE public.workspace_users
SET role = 'member'
WHERE role IS NULL
   OR role NOT IN ('admin', 'member');

-- 1b) Ensure every workspace owner has an admin membership row (legacy safety)
INSERT INTO public.workspace_users (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'admin'
FROM public.workspaces w
WHERE w.owner_id IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO UPDATE
  SET role = excluded.role;

-- 2) Ensure default is member
ALTER TABLE public.workspace_users
  ALTER COLUMN role SET DEFAULT 'member';

-- 3) Enforce allowed role values (admin/member only)
DO $$
BEGIN
  ALTER TABLE public.workspace_users
    ADD CONSTRAINT workspace_users_role_check
    CHECK (role IN ('admin', 'member'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4) Workspace creator should be admin (replaces legacy 'owner')
CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'workspace name is required';
  END IF;

  INSERT INTO public.workspaces (name, owner_id)
  VALUES (trim(p_name), v_user_id)
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_users (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'admin')
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = excluded.role;

  RETURN v_workspace_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_workspace_with_owner(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.create_workspace_with_owner(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(text) TO service_role;

-- 5) Helper RPC: admin check (admin only; legacy owner removed)
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.workspace_users
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_workspace_admin(UUID) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID) TO service_role;

-- 6) Harden RPC: workspace member listing must require membership
CREATE OR REPLACE FUNCTION public.get_workspace_members(p_workspace_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role text,
  email text,
  display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    wu.id,
    wu.user_id,
    wu.role,
    u.email,
    coalesce(nullif(trim(u.email), ''), wu.user_id::text) as display_name
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

-- 7) RLS: workspace_users membership management is admin-only (select is workspace-scoped)
DROP POLICY IF EXISTS workspace_users_insert_owner ON public.workspace_users;
DROP POLICY IF EXISTS workspace_users_update_owner ON public.workspace_users;
DROP POLICY IF EXISTS workspace_users_delete_owner ON public.workspace_users;

DROP POLICY IF EXISTS workspace_users_insert_admin ON public.workspace_users;
DROP POLICY IF EXISTS workspace_users_update_admin ON public.workspace_users;
DROP POLICY IF EXISTS workspace_users_delete_admin ON public.workspace_users;

CREATE POLICY workspace_users_insert_admin
ON public.workspace_users
FOR INSERT
WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY workspace_users_update_admin
ON public.workspace_users
FOR UPDATE
USING (public.is_workspace_admin(workspace_id))
WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY workspace_users_delete_admin
ON public.workspace_users
FOR DELETE
USING (public.is_workspace_admin(workspace_id));

-- 8) RLS: campaigns are readable by members, writable by admin only
DROP POLICY IF EXISTS campaigns_insert ON public.campaigns;
DROP POLICY IF EXISTS campaigns_update ON public.campaigns;
DROP POLICY IF EXISTS campaigns_delete ON public.campaigns;
DROP POLICY IF EXISTS campaigns_select ON public.campaigns;

CREATE POLICY campaigns_select
ON public.campaigns
FOR SELECT
USING (public.is_user_in_workspace(workspace_id));

CREATE POLICY campaigns_insert
ON public.campaigns
FOR INSERT
WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY campaigns_update
ON public.campaigns
FOR UPDATE
USING (public.is_workspace_admin(workspace_id))
WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY campaigns_delete
ON public.campaigns
FOR DELETE
USING (public.is_workspace_admin(workspace_id));

-- 9) RLS: stages are readable by members, writable by admin only
DROP POLICY IF EXISTS stages_insert ON public.stages;
DROP POLICY IF EXISTS stages_update ON public.stages;
DROP POLICY IF EXISTS stages_delete ON public.stages;
DROP POLICY IF EXISTS stages_select ON public.stages;

CREATE POLICY stages_select
ON public.stages
FOR SELECT
USING (public.is_user_in_workspace(workspace_id));

CREATE POLICY stages_insert
ON public.stages
FOR INSERT
WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY stages_update
ON public.stages
FOR UPDATE
USING (public.is_workspace_admin(workspace_id))
WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY stages_delete
ON public.stages
FOR DELETE
USING (public.is_workspace_admin(workspace_id));

-- 10) RLS: workspace_custom_fields management is admin-only (select for members)
DROP POLICY IF EXISTS "Users can view custom fields of their workspaces" ON public.workspace_custom_fields;
DROP POLICY IF EXISTS "Workspace admins can manage custom fields" ON public.workspace_custom_fields;

CREATE POLICY "Users can view custom fields of their workspaces"
ON public.workspace_custom_fields
FOR SELECT
USING (public.is_user_in_workspace(workspace_id));

CREATE POLICY "Workspace admins can manage custom fields"
ON public.workspace_custom_fields
FOR ALL
USING (public.is_workspace_admin(workspace_id))
WITH CHECK (public.is_workspace_admin(workspace_id));
