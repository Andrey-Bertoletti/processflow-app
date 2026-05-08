-- Migration: Harden campaigns RLS (admin-only writes)
-- Timestamp: 2026-05-07 19:30:00
--
-- Why:
-- A legacy migration (20260505120000_create_campaigns.sql) created permissive policies that allowed
-- any workspace member to INSERT/UPDATE/DELETE campaigns. With multiple permissive policies, RLS
-- conditions are OR-ed, so those legacy policies would still allow members to change admin config.
--
-- Desired:
-- - Members can READ campaigns in their workspace.
-- - Only admins can INSERT/UPDATE/DELETE campaigns.
--
-- The admin/member policies are already created in 20260507090000_workspace_roles_admin_member.sql.
-- Here we just drop the legacy permissive policies (idempotent).

DROP POLICY IF EXISTS "Users can view campaigns from their workspace" ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert campaigns to their workspace" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update campaigns in their workspace" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns from their workspace" ON public.campaigns;

